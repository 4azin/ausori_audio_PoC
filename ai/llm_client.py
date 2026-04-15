"""Gemini 호출 가시성 래퍼 + Langfuse 연동.

사용법:
    from llm_client import generate_content, get_tracker, start_trace, start_span

    with start_trace(job_id, name="pipeline", metadata={...}) as trace:
        with start_span("global"):
            response = generate_content(
                client, model=GEMINI_MODEL, contents=contents,
                stage="global",
            )
        ...
        trace.update(output=result_metrics)

환경변수:
    LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST  → 연결 시 활성화
    LLM_USAGE_LOG  → JSONL 파일 경로 (옵션)

Langfuse 미설정/미설치인 경우 no-op 으로 동작하여 로컬 실행이 항상 가능하다.
"""

from __future__ import annotations

import contextlib
import json
import os
import threading
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

try:
    from langfuse import Langfuse
    _langfuse_available = True
except Exception:
    Langfuse = None  # type: ignore[assignment]
    _langfuse_available = False


# ---------------------------------------------------------------------------
# 가격표 (USD / 1M tokens). 필요 시 조정.
# ---------------------------------------------------------------------------
PRICING: dict[str, dict[str, float]] = {
    "gemini-3-flash-preview":  {"input": 0.30, "output": 2.50, "cached": 0.075},
    "gemini-3.1-pro-preview":  {"input": 2.00, "output": 12.00, "cached": 0.50},
    "gemini-2.5-flash":        {"input": 0.30, "output": 2.50, "cached": 0.075},
    "gemini-2.5-pro":          {"input": 1.25, "output": 10.00, "cached": 0.31},
}


def _price_for(model: str) -> dict[str, float]:
    if model in PRICING:
        return PRICING[model]
    for key, val in PRICING.items():
        if model.startswith(key) or key.startswith(model):
            return val
    return {"input": 0.0, "output": 0.0, "cached": 0.0}


# ---------------------------------------------------------------------------
# 기록 단위 (in-process 집계 용)
# ---------------------------------------------------------------------------

@dataclass
class CallRecord:
    stage: str
    model: str
    prompt_tokens: int
    output_tokens: int
    cached_tokens: int
    total_tokens: int
    latency_sec: float
    cost_usd: float
    scene_id: int | None = None
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class UsageTracker:
    records: list[CallRecord] = field(default_factory=list)
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def add(self, rec: CallRecord) -> None:
        with self._lock:
            self.records.append(rec)

    def reset(self) -> None:
        with self._lock:
            self.records.clear()

    def totals(self) -> dict[str, Any]:
        with self._lock:
            recs = list(self.records)
        by_stage: dict[str, dict[str, float]] = {}
        for r in recs:
            s = by_stage.setdefault(
                r.stage,
                {"calls": 0, "prompt": 0, "output": 0, "cached": 0,
                 "total": 0, "latency_sec": 0.0, "cost_usd": 0.0},
            )
            s["calls"] += 1
            s["prompt"] += r.prompt_tokens
            s["output"] += r.output_tokens
            s["cached"] += r.cached_tokens
            s["total"] += r.total_tokens
            s["latency_sec"] += r.latency_sec
            s["cost_usd"] += r.cost_usd
        agg = {
            "calls": len(recs),
            "prompt": sum(r.prompt_tokens for r in recs),
            "output": sum(r.output_tokens for r in recs),
            "cached": sum(r.cached_tokens for r in recs),
            "total": sum(r.total_tokens for r in recs),
            "latency_sec": sum(r.latency_sec for r in recs),
            "cost_usd": sum(r.cost_usd for r in recs),
        }
        return {"overall": agg, "by_stage": by_stage}

    def summary(self) -> str:
        t = self.totals()
        o = t["overall"]
        lines = [
            "=== LLM Usage Summary ===",
            f"calls={o['calls']}  prompt={o['prompt']}  output={o['output']}  "
            f"cached={o['cached']}  total={o['total']}  "
            f"latency={o['latency_sec']:.1f}s  cost=${o['cost_usd']:.4f}",
            "--- by stage ---",
        ]
        for stage, s in t["by_stage"].items():
            lines.append(
                f"  {stage:20s} calls={s['calls']}  prompt={s['prompt']}  "
                f"output={s['output']}  total={s['total']}  "
                f"latency={s['latency_sec']:.1f}s  cost=${s['cost_usd']:.4f}"
            )
        return "\n".join(lines)


_tracker = UsageTracker()


def get_tracker() -> UsageTracker:
    return _tracker


# ---------------------------------------------------------------------------
# Langfuse 클라이언트 (선택적)
# ---------------------------------------------------------------------------

_langfuse = None

def _get_langfuse():
    global _langfuse
    if _langfuse is not None:
        return _langfuse
    if not _langfuse_available:
        return None
    pk = os.getenv("LANGFUSE_PUBLIC_KEY")
    sk = os.getenv("LANGFUSE_SECRET_KEY")
    host = os.getenv("LANGFUSE_HOST", "http://localhost:3000")
    if not pk or not sk:
        return None
    try:
        _langfuse = Langfuse(public_key=pk, secret_key=sk, host=host)
        print(f"[llm] Langfuse 연결됨: {host}")
    except Exception as e:
        print(f"[llm] Langfuse 초기화 실패 (계속 진행): {e}")
        _langfuse = None
    return _langfuse


# ---------------------------------------------------------------------------
# 트레이스/스팬 컨텍스트 매니저
# ---------------------------------------------------------------------------

class _TraceHandle:
    """Langfuse trace 를 감싸는 얇은 핸들. Langfuse 없을 땐 no-op."""

    def __init__(self, span):
        self._span = span  # langfuse RootSpan context or None

    def update(self, **kwargs) -> None:
        if self._span is None:
            return
        try:
            self._span.update_trace(**kwargs)
        except Exception:
            pass


@contextlib.contextmanager
def start_trace(
    job_id: str,
    name: str = "pipeline",
    metadata: dict[str, Any] | None = None,
    input: Any = None,
):
    """Job 단위 root trace 를 연다. Langfuse 미설정 시 no-op."""
    lf = _get_langfuse()
    if lf is None:
        yield _TraceHandle(None)
        return
    ctx = lf.start_as_current_span(
        name=name,
        input=input,
        metadata=metadata or {},
    )
    with ctx as span:
        try:
            span.update_trace(
                name=name,
                session_id=job_id,
                metadata=metadata or {},
                input=input,
            )
        except Exception:
            pass
        try:
            yield _TraceHandle(span)
        finally:
            try:
                lf.flush()
            except Exception:
                pass


@contextlib.contextmanager
def start_span(name: str, metadata: dict[str, Any] | None = None):
    """Analyzer stage 단위 span. Langfuse 미설정 시 no-op."""
    lf = _get_langfuse()
    if lf is None:
        yield None
        return
    with lf.start_as_current_span(name=name, metadata=metadata or {}) as span:
        yield span


# ---------------------------------------------------------------------------
# 프롬프트 로딩 (Langfuse Prompts)
# ---------------------------------------------------------------------------

@dataclass
class PromptHandle:
    """컴파일된 프롬프트 텍스트 + Langfuse 링크용 원본 객체."""
    text: str
    name: str
    version: int | str | None = None
    label: str | None = None
    source: str = "local"   # "langfuse" | "local"
    client_obj: Any = None  # Langfuse TextPromptClient (링크용)


def get_prompt(
    name: str,
    *,
    fallback: str,
    label: str | None = None,
    variables: dict[str, Any] | None = None,
) -> PromptHandle:
    """Langfuse 에서 프롬프트를 가져오되, 실패 시 `fallback` 사용.

    - `label` 지정 시 해당 라벨(예: "production", "staging")을 가져오고,
      미지정 시 Langfuse 기본(label=production) 동작을 따른다.
    - `variables` 가 있으면 `.compile(**variables)` 로 치환한다. 없으면 텍스트 그대로.
    """
    lf = _get_langfuse()
    if lf is not None:
        try:
            kwargs = {}
            if label is not None:
                kwargs["label"] = label
            prompt_obj = lf.get_prompt(name, **kwargs)
            text = (
                prompt_obj.compile(**(variables or {}))
                if variables
                else prompt_obj.prompt
            )
            return PromptHandle(
                text=text,
                name=name,
                version=getattr(prompt_obj, "version", None),
                label=label,
                source="langfuse",
                client_obj=prompt_obj,
            )
        except Exception as e:
            print(f"[llm] Langfuse get_prompt({name}) 실패, 로컬 fallback: {e}")
    return PromptHandle(text=fallback, name=name, source="local")


# ---------------------------------------------------------------------------
# 로그 싱크
# ---------------------------------------------------------------------------

_LOG_PATH = os.getenv("LLM_USAGE_LOG")
_log_lock = threading.Lock()


def _emit(record: CallRecord) -> None:
    payload = {"ts": time.time(), **asdict(record)}
    line = json.dumps(payload, ensure_ascii=False)
    print(f"[llm] {line}")
    if _LOG_PATH:
        with _log_lock:
            Path(_LOG_PATH).parent.mkdir(parents=True, exist_ok=True)
            with open(_LOG_PATH, "a", encoding="utf-8") as f:
                f.write(line + "\n")


# ---------------------------------------------------------------------------
# 래퍼 호출
# ---------------------------------------------------------------------------

def _summarize_contents(contents) -> dict[str, Any]:
    """Gemini contents 에서 프롬프트 텍스트 + 첨부 요약을 뽑는다 (프레임 바이너리 제외)."""
    text_parts: list[str] = []
    image_count = 0
    other_count = 0
    try:
        for item in contents:
            if isinstance(item, str):
                text_parts.append(item)
                continue
            mime = getattr(getattr(item, "inline_data", None), "mime_type", None)
            if mime is None:
                mime = getattr(item, "mime_type", None)
            if mime and str(mime).startswith("image/"):
                image_count += 1
            else:
                other_count += 1
    except Exception:
        pass
    return {
        "prompt_text": "\n".join(text_parts) if text_parts else None,
        "image_count": image_count,
        "other_attachment_count": other_count,
    }


def generate_content(
    client,
    *,
    model: str,
    contents,
    stage: str,
    scene_id: int | None = None,
    prompt: PromptHandle | None = None,
    **kwargs,
):
    """`client.models.generate_content` 대체 래퍼.

    prompt: Langfuse 프롬프트 핸들. 전달 시 generation ↔ prompt 버전이 링크된다.
    """
    lf = _get_langfuse()
    summary = _summarize_contents(contents)
    gen_input = {
        "prompt": summary["prompt_text"],
        "image_count": summary["image_count"],
    }
    gen_metadata = {
        "stage": stage,
        "scene_id": scene_id,
        "prompt_name": prompt.name if prompt else None,
        "prompt_version": prompt.version if prompt else None,
        "prompt_source": prompt.source if prompt else None,
    }

    gen_ctx = None
    if lf is not None:
        try:
            gen_kwargs: dict[str, Any] = dict(
                name=f"gemini:{stage}" + (f":scene{scene_id}" if scene_id is not None else ""),
                model=model,
                input=gen_input,
                metadata=gen_metadata,
            )
            if prompt is not None and prompt.client_obj is not None:
                gen_kwargs["prompt"] = prompt.client_obj
            gen_ctx = lf.start_as_current_generation(**gen_kwargs)
        except Exception:
            gen_ctx = None

    if gen_ctx is not None:
        gen = gen_ctx.__enter__()
    else:
        gen = None

    t0 = time.perf_counter()
    try:
        response = client.models.generate_content(model=model, contents=contents, **kwargs)
    except Exception as e:
        if gen_ctx is not None:
            try:
                gen.update(level="ERROR", status_message=str(e))
            finally:
                gen_ctx.__exit__(type(e), e, e.__traceback__)
        raise
    latency = time.perf_counter() - t0

    um = getattr(response, "usage_metadata", None)
    prompt = int(getattr(um, "prompt_token_count", 0) or 0) if um else 0
    output = int(getattr(um, "candidates_token_count", 0) or 0) if um else 0
    cached = int(getattr(um, "cached_content_token_count", 0) or 0) if um else 0
    total = int(getattr(um, "total_token_count", 0) or 0) if um else (prompt + output)

    price = _price_for(model)
    billable_prompt = max(prompt - cached, 0)
    cost = (
        billable_prompt * price["input"]
        + cached * price["cached"]
        + output * price["output"]
    ) / 1_000_000

    rec = CallRecord(
        stage=stage, model=model,
        prompt_tokens=prompt, output_tokens=output,
        cached_tokens=cached, total_tokens=total,
        latency_sec=latency, cost_usd=cost,
        scene_id=scene_id,
    )
    _tracker.add(rec)
    _emit(rec)

    if gen_ctx is not None:
        try:
            raw_output = getattr(response, "text", None)
            gen.update(
                output=raw_output,
                usage_details={
                    "input": prompt,
                    "output": output,
                    "cached_input": cached,
                    "total": total,
                },
                cost_details={"total": cost},
                metadata={**gen_metadata, "latency_sec": latency},
            )
        except Exception:
            pass
        finally:
            gen_ctx.__exit__(None, None, None)

    return response
