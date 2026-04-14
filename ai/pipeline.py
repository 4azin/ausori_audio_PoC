"""AI 분석 파이프라인.

단계:
  1. global_analyzing  — 전체 영상 맥락 분석 + scene 분할
  2. foley_analyzing   — scene별 Foley 이벤트 추출
  3. non_foley_analyzing — scene별 Non-Foley 트랙 배치 결정
  4. done              — 결과 패키징

효과음 매칭/검색은 backend (pgvector)에서 담당.
AI는 분석 결과 JSON까지만 생성하여 backend로 넘긴다.

[local 실행 법 - redis 없이.]
```
python -c "
import pipeline, json

job = {
    'job_id': 'test_001',
    'video_path': '당근광고영상.mp4'
}

result = pipeline.run(job)

with open('pipeline_result.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print('완료')
"
```

"""

import json
import os
import tempfile

try:
    import redis_client as rc
    _redis_available = True
except Exception:
    _redis_available = False

import analyze_global
import analyze_local_foley
import analyze_local_non_foley


def _progress(job_id: str, status: str, pct: int) -> None:
    """Redis 없이도 동작하는 progress 업데이트."""
    print(f"[progress] {status} {pct}%")
    if _redis_available:
        try:
            rc.set_progress(job_id, status, pct)
        except Exception:
            pass


def run(job: dict) -> dict:
    """영상 분석 파이프라인 실행."""
    job_id = job["job_id"]
    video_path = job["video_path"]  # worker가 S3에서 내려받은 로컬 경로

    # 1. 전체 영상 글로벌 분석
    _progress(job_id, "global_analyzing", 10)
    global_result = analyze_global.analyze(video_path)
    _progress(job_id, "global_analyzing", 35)

    # 2. Foley 분석 + 3. Non-Foley 분석
    # analyze_all 함수들이 JSON 파일 경로를 받으므로 임시 파일로 연결
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False, encoding="utf-8"
    ) as f:
        json.dump(global_result, f, ensure_ascii=False)
        global_json_path = f.name

    try:
        _progress(job_id, "foley_analyzing", 40)
        foley_result = analyze_local_foley.analyze_all(video_path, global_json_path)
        _progress(job_id, "foley_analyzing", 65)

        _progress(job_id, "non_foley_analyzing", 70)
        non_foley_result = analyze_local_non_foley.analyze_all(video_path, global_json_path)
        _progress(job_id, "non_foley_analyzing", 90)
    finally:
        os.unlink(global_json_path)

    # 4. 결과 패키징
    result = _package(global_result, foley_result, non_foley_result)

    _progress(job_id, "done", 100)
    return result


NON_FOLEY_TRACKS = ["ambience", "music", "cinematic", "sfx", "dialogue_vo"]


def _package(global_result: dict, foley_result: dict, non_foley_result: dict) -> dict:
    """세 분석 결과를 트랙 종류별로 합치고 시간 오름차순 정렬."""

    # Foley: 전체 scene의 events 수집 → start_time(ms) 오름차순
    foley_events = []
    for scene in foley_result.get("scenes", []):
        foley_events.extend(scene.get("events", []))
    foley_events.sort(key=lambda e: e.get("start_time", 0))

    # Non-Foley: 트랙 종류별로 수집 → start_time(초) 오름차순
    track_map: dict[str, list] = {t: [] for t in NON_FOLEY_TRACKS}
    for scene in non_foley_result.get("scenes", []):
        for entry in scene.get("tracks", []):
            track_name = entry.get("track", "")
            if track_name in track_map:
                track_map[track_name].append(entry)

    for track_name in track_map:
        track_map[track_name].sort(key=lambda e: e.get("start_time", 0))

    return {
        "video_summary": global_result.get("video_summary", ""),
        "video_context": global_result.get("video_context", ""),
        "foley": foley_events,
        **track_map,
    }
