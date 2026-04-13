"""AI 분석 파이프라인 — 각 단계는 추후 실제 모델로 교체."""

import redis_client as rc


def run(job: dict) -> None:
    """영상 분석 파이프라인 실행.

    단계: scene_splitting → analyzing → refining_timing → matching → placing → done
    """
    job_id = job["job_id"]
    video_path = job["video_path"]

    # 1. 장면 분할
    rc.set_progress(job_id, "scene_splitting", 10)
    scenes = _split_scenes(video_path)

    # 2. 장면 분석
    rc.set_progress(job_id, "analyzing", 30)
    analysis = _analyze_scenes(scenes)

    # 3. 타이밍 정제
    rc.set_progress(job_id, "refining_timing", 50)
    timings = _refine_timing(analysis)

    # 4. 효과음 매칭
    rc.set_progress(job_id, "matching", 70)
    matches = _match_sounds(timings)

    # 5. 타임라인 배치
    rc.set_progress(job_id, "placing", 90)
    result = _place_on_timeline(matches)

    rc.set_progress(job_id, "done", 100)
    return result


# --- stub functions (추후 실제 구현으로 교체) ---

def _split_scenes(video_path: str) -> list:
    """TODO: 영상을 장면 단위로 분할."""
    return []


def _analyze_scenes(scenes: list) -> list:
    """TODO: 각 장면 분석 (Gemini 등)."""
    return []


def _refine_timing(analysis: list) -> list:
    """TODO: 효과음 시작/종료 타이밍 정제."""
    return []


def _match_sounds(timings: list) -> list:
    """TODO: 임베딩 유사도 기반 효과음 매칭."""
    return []


def _place_on_timeline(matches: list) -> dict:
    """TODO: 매칭 결과를 track_events 형태로 변환."""
    return {"track_events": []}
