"""AI 분석 파이프라인.

계약: ai/redis_contract.md

단계 (status / currentStage):
  preprocessing       → pending          / preprocessing
  global              → scene_splitting  / global_scene_split
  foley               → analyzing        / analyzing_hard
  non_foley           → analyzing        / analyzing_soft
  done                → done             / done

효과음 매칭/검색은 backend (pgvector)에서 담당.
AI는 raw 분석 이벤트 JSON 까지만 생성한다.
"""

from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from typing import Any

try:
    import redis_client as rc
    _redis_available = True
except Exception:
    rc = None  # type: ignore[assignment]
    _redis_available = False

import analyze_global
import analyze_local_foley
import analyze_local_non_foley
import llm_client


FOLEY_MAJOR = "Foley"


def _progress(
    job_id: str,
    project_id: int | None,
    *,
    status: str,
    progress: int,
    current_stage: str,
    message: str | None = None,
) -> None:
    print(f"[progress] {status}/{current_stage} {progress}%")
    if _redis_available and project_id is not None:
        try:
            rc.set_progress(
                job_id, project_id,
                status=status, progress=progress,
                current_stage=current_stage, message=message,
            )
        except Exception:
            pass


def run(job, video_path: str | None = None):
    """영상 분석 파이프라인 실행.

    job: `rc.JobRequest` | dict (로컬 테스트용 dict 도 허용)
    video_path: 워커가 S3 에서 내려받은 로컬 경로. 생략 시 job.video_path 사용.
    반환: rc.JobDoneMessage (redis_client 가 XADD)
    """
    job_id, project_id, src_path, video_summary_hint = _unpack_job(job)
    local_video = video_path or src_path

    tracker = llm_client.get_tracker()
    tracker.reset()

    trace_metadata = {
        "job_id": job_id,
        "project_id": project_id,
        "video_path": local_video,
        "video_name": os.path.basename(local_video),
    }

    with llm_client.start_trace(
        job_id=job_id,
        name="ai-pipeline",
        metadata=trace_metadata,
        input={"job_id": job_id, "video_path": local_video},
    ) as trace:

        _progress(job_id, project_id,
                  status="scene_splitting", progress=10,
                  current_stage="global_scene_split")
        with llm_client.start_span("global_analyzing"):
            global_result = analyze_global.analyze(local_video)
        _progress(job_id, project_id,
                  status="scene_splitting", progress=35,
                  current_stage="global_scene_split")

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8"
        ) as f:
            json.dump(global_result, f, ensure_ascii=False)
            global_json_path = f.name

        try:
            _progress(job_id, project_id,
                      status="analyzing", progress=40,
                      current_stage="analyzing_hard")
            with llm_client.start_span("foley_analyzing"):
                foley_result = analyze_local_foley.analyze_all(local_video, global_json_path)
            _progress(job_id, project_id,
                      status="analyzing", progress=65,
                      current_stage="analyzing_hard")

            _progress(job_id, project_id,
                      status="analyzing", progress=70,
                      current_stage="analyzing_soft")
            with llm_client.start_span("non_foley_analyzing"):
                non_foley_result = analyze_local_non_foley.analyze_all(local_video, global_json_path)
            _progress(job_id, project_id,
                      status="analyzing", progress=90,
                      current_stage="analyzing_soft")
        finally:
            os.unlink(global_json_path)

        events = _to_ai_events(foley_result, non_foley_result)
        metrics = _compute_metrics(global_result, events)
        usage = tracker.totals()
        print(tracker.summary())

        done = _build_done_message(
            job_id=job_id, project_id=project_id,
            global_result=global_result, events=events,
            llm_usage=usage, metrics=metrics,
        )

        trace.update(
            output={"metrics": metrics, "llm_usage": usage["overall"]},
            metadata={
                **trace_metadata,
                "metrics": metrics,
                "llm_usage_by_stage": usage["by_stage"],
            },
        )

        _progress(job_id, project_id,
                  status="done", progress=100, current_stage="done")
        return done


# ---------------------------------------------------------------------------
# Job unpacking (pydantic JobRequest 또는 dict)
# ---------------------------------------------------------------------------

def _unpack_job(job) -> tuple[str, int | None, str, None]:
    if _redis_available and isinstance(job, rc.JobRequest):
        return job.job_id, job.project_id, job.video_path, None

    # dict fallback (로컬 테스트)
    job_id = job.get("jobId") or job.get("job_id")
    project_id = job.get("projectId") or job.get("project_id")
    video_path = job.get("videoPath") or job.get("video_path")
    if not job_id or not video_path:
        raise ValueError("job dict 은 jobId/videoPath (또는 snake_case) 필수")
    return job_id, project_id, video_path, None


# ---------------------------------------------------------------------------
# 이벤트 통합 (§4-2 AiEvent 단일 스키마)
# ---------------------------------------------------------------------------

def _to_ai_events(foley_result: dict, non_foley_result: dict) -> list[dict]:
    out: list[dict] = []

    for scene in foley_result.get("scenes", []):
        for e in scene.get("events", []):
            out.append(_foley_to_ai_event(e))

    for scene in non_foley_result.get("scenes", []):
        for e in scene.get("tracks", []):
            out.append(_non_foley_to_ai_event(e))

    out.sort(key=lambda x: x["start_time"])
    return out


def _foley_to_ai_event(e: dict) -> dict:
    """foley 프롬프트 출력 스키마 (초, category_path, tags) 를 AiEvent 로 정규화."""
    category_path = list(e.get("category_path") or [])
    if len(category_path) != 3:
        # 구버전/LLM 누락 방어 — tags 첫 원소 \"Mid:Leaf\" 에서 유도
        tags_fallback = e.get("tags") or e.get("event_tags") or []
        category_path = _foley_fallback_category(tags_fallback[0] if tags_fallback else None)

    return {
        "track": "foley",
        "description": e.get("description", ""),
        "category_path": category_path,
        "start_time": float(e.get("start_time", 0.0)),
        "end_time": float(e.get("end_time", 0.0)),
        "peak_time": float(e["peak_time"]) if e.get("peak_time") is not None else None,
        "mood": [],
        "energy": None,
        "texture": None,
        "tags": list(e.get("tags") or e.get("event_tags") or []),
        "confidence": float(e.get("confidence", 0.0)),
    }


def _foley_fallback_category(tag: str | None) -> list[str]:
    if not tag or ":" not in tag:
        return [FOLEY_MAJOR, "Unknown", "Unknown"]
    mid, _, leaf = tag.partition(":")
    return [FOLEY_MAJOR, mid or "Unknown", leaf or "Unknown"]


def _non_foley_to_ai_event(e: dict) -> dict:
    return {
        "track": e.get("track", ""),
        "description": e.get("description", ""),
        "category_path": list(e.get("category_path") or []),
        "start_time": float(e.get("start_time", 0.0)),
        "end_time": float(e.get("end_time", 0.0)),
        "peak_time": None,
        "mood": list(e.get("mood") or []),
        "energy": e.get("energy"),
        "texture": e.get("texture"),
        "tags": list(e.get("tags") or []),
        "confidence": float(e.get("confidence", 0.0)),
    }


# ---------------------------------------------------------------------------
# 관측 지표
# ---------------------------------------------------------------------------

def _compute_metrics(global_result: dict, events: list[dict]) -> dict[str, Any]:
    by_track: dict[str, list[dict]] = {}
    for e in events:
        by_track.setdefault(e["track"], []).append(e)

    foley_events = by_track.get("foley", [])
    non_foley = [e for t, xs in by_track.items() if t != "foley" for e in xs]

    return {
        "scene_count": len(global_result.get("scenes", [])),
        "event_count": len(events),
        "foley_event_count": len(foley_events),
        "foley_confidence": _conf_stats(foley_events),
        "non_foley_total_count": len(non_foley),
        "non_foley_confidence": _conf_stats(non_foley),
        "events_by_track": {t: len(xs) for t, xs in by_track.items()},
        "non_foley_mood_fill_ratio": _fill_ratio(non_foley, "mood"),
        "non_foley_energy_fill_ratio": _fill_ratio(non_foley, "energy"),
        "non_foley_texture_fill_ratio": _fill_ratio(non_foley, "texture"),
    }


def _conf_stats(items: list[dict]) -> dict[str, Any]:
    vals = [float(it["confidence"]) for it in items if isinstance(it.get("confidence"), (int, float))]
    if not vals:
        return {"count": 0, "mean": None, "min": None, "max": None}
    vals_sorted = sorted(vals)
    mid = len(vals_sorted) // 2
    p50 = vals_sorted[mid] if len(vals_sorted) % 2 else (vals_sorted[mid - 1] + vals_sorted[mid]) / 2
    return {
        "count": len(vals),
        "mean": sum(vals) / len(vals),
        "p50": p50,
        "min": min(vals),
        "max": max(vals),
    }


def _fill_ratio(items: list[dict], field: str) -> float | None:
    if not items:
        return None
    filled = sum(1 for it in items if it.get(field))
    return filled / len(items)


# ---------------------------------------------------------------------------
# JobDoneMessage 빌드
# ---------------------------------------------------------------------------

def _build_done_message(
    *,
    job_id: str,
    project_id: int | None,
    global_result: dict,
    events: list[dict],
    llm_usage: dict,
    metrics: dict,
):
    telemetry = {
        "sceneCount": metrics["scene_count"],
        "llmUsage": llm_usage["overall"],
        "metrics": metrics,
    }
    payload = {
        "job_id": job_id,
        "project_id": project_id if project_id is not None else 0,
        "completed_at": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
        "video_summary": global_result.get("video_summary", ""),
        "video_context": global_result.get("video_context", ""),
        "events": events,
        "telemetry": telemetry,
    }
    if _redis_available:
        return rc.JobDoneMessage.model_validate(payload)
    return payload
