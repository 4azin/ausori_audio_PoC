"""글로벌 영상 분석 — 바로 실행 가능한 독립 스크립트.

사용법:
    python analyze_global.py <video_path>
    python analyze_global.py <video_path> --fps 1 --max-frames 40
    python analyze_global.py <video_path> --out result.json
"""

import argparse
import json
import os
import subprocess
from pathlib import Path

from google import genai
from dotenv import load_dotenv

import config
import llm_client
import video_upload


load_dotenv()

GEMINI_API_VIDEO = config.GEMINI_API_VIDEO
GEMINI_MODEL = config.GEMINI_MODEL_GLOBAL

PROMPT = """\
You are a video analyst.
Watch the entire input video from start to finish, then split it into scenes based on the flow of the video.

[Goal]
- Split the entire video into multiple scenes.
- Each scene must be a single meaningful contextual unit.
- Avoid splits that are too short or awkward, and follow the length constraint below:
  - Maximum length: 30 seconds

[Splitting Criteria]
- Split on scene transitions, topic changes, action changes, location changes, perspective shifts, mood changes, or the start/end of events.
- Do not mechanically cut every few seconds — split naturally by meaning.
- Do not over-segment. Split at a granularity useful for downstream search, editing, and summarization.

[Output Content]
1. A one-line summary of the entire video
2. An overall context description of the video
3. A list of scenes
4. For each scene:
   - scene_id
   - start_time
   - end_time
   - scene_context // What role does this segment play in the overall video?
   - scene_summary // A summary of this segment
   - key_events
   - visual_cues

[Language]
- All output text (video_summary, video_context, scene_summary, scene_context, key_events, visual_cues) MUST be in English.

[Output Format]
- Output ONLY valid JSON. No markdown code blocks.
- Do not write any explanatory text outside the JSON.
- Times are in seconds (float or int).
- scene_id starts at 1 (integer).
- Scenes must be sorted chronologically.
- Scene time ranges must not overlap.
- Scenes should cover the video from start to end as completely as possible.

[JSON Schema]
{
  "video_summary": "string",
  "video_context": "string",
  "scenes": [
    {
      "scene_id": 1,
      "start_time": 0.0,
      "end_time": 15.0,
      "scene_summary": "One-line scene summary",
      "scene_context": "Role of this scene within the overall video",
      "key_events": ["Key action 1", "Key action 2"],
      "visual_cues": ["Location", "Characters", "Visual transition"]
    }
  ]
}
"""


# ---------------------------------------------------------------------------
# ffmpeg 유틸
# ---------------------------------------------------------------------------

def get_duration(video_path: str) -> float:
    """ffprobe로 영상 길이(초) 반환."""
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return float(result.stdout.strip())


# ---------------------------------------------------------------------------
# 분석
# ---------------------------------------------------------------------------

def analyze(video_path: str) -> dict:
    if not GEMINI_API_VIDEO:
        raise EnvironmentError("GEMINI_API_VIDEO가 설정되지 않았습니다. .env 파일을 확인하세요.")

    client = genai.Client(api_key=GEMINI_API_VIDEO)

    duration = get_duration(video_path)
    print(f"[info] 영상 길이: {duration:.1f}초")

    video_file = video_upload.upload_video(client, video_path)

    try:
        context = f"[Video Info]\nDuration: {duration:.1f}s\n\n"
        prompt = llm_client.get_prompt("global_analyzer", fallback=PROMPT)
        contents = [context + prompt.text, video_file]

        print(f"[info] Gemini 호출 중... (model={GEMINI_MODEL}, prompt={prompt.name}@{prompt.version}/{prompt.source})")
        response = llm_client.generate_content(
            client, model=GEMINI_MODEL, contents=contents, stage="global", prompt=prompt,
        )
    finally:
        video_upload.delete_video(client, video_file)

    raw = response.text.strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    return json.loads(raw)


# ---------------------------------------------------------------------------
# 진입점
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="영상 글로벌 분석 (Gemini)")
    parser.add_argument("video", help="분석할 영상 파일 경로")
    parser.add_argument("--out", help="결과를 저장할 JSON 파일 경로 (생략 시 stdout 출력)")
    args = parser.parse_args()

    result = analyze(args.video)

    output = json.dumps(result, ensure_ascii=False, indent=2)

    if args.out:
        Path(args.out).write_text(output, encoding="utf-8")
        print(f"[done] 결과 저장: {args.out}")
    else:
        print(output)


if __name__ == "__main__":
    main()
