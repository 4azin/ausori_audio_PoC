"""AI 분석 파이프라인 — 각 단계는 추후 실제 모델로 교체.

효과음 매칭/검색은 backend (pgvector)에서 담당.
AI는 장면 설명 텍스트까지만 생성하여 backend로 넘긴다.
"""

import redis_client as rc


def run(job: dict) -> dict:
    """영상 분석 파이프라인 실행.

    단계: scene_splitting → analyzing → refining_timing → done
    """
    job_id = job["job_id"]
    video_path = job["video_path"]

    # 1. 장면 분할
    rc.set_progress(job_id, "scene_splitting", 20)
    scenes = _split_scenes(video_path)

    # 2. 장면 분석 (장면별 설명 텍스트 생성)
    rc.set_progress(job_id, "analyzing", 50)
    analysis = _analyze_scenes(scenes)

    # 3. 타이밍 정제
    rc.set_progress(job_id, "refining_timing", 80)
    result = _refine_timing(analysis)

    rc.set_progress(job_id, "done", 100)
    return result


# --- stub functions (추후 실제 구현으로 교체) ---

def _split_scenes(video_path: str) -> list:
    """TODO: 영상을 장면 단위로 분할."""
    return []


def _analyze_scenes(scenes: list) -> list:
    """TODO: 각 장면 설명 텍스트 생성 (Gemini 등).

    반환 형식: [{ "start": float, "end": float, "description": str }, ...]
    """
    return []


def _refine_timing(analysis: list) -> dict:
    """TODO: 장면별 효과음 타이밍 정제.

    반환 형식: { "scenes": [{ "start", "end", "description" }, ...] }
    backend가 이 description을 임베딩하여 sound_assets에서 유사도 검색.
    """
    return {"scenes": analysis}
