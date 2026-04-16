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
당신은 영상 분석가다.
입력된 영상 전체를 처음부터 끝까지 시청한 뒤, 영상의 흐름을 기준으로 장면(scene)을 분할하라.

[목표]
- 전체 영상을 여러 개의 scene으로 나눈다.
- 각 scene은 하나의 의미 있는 맥락 단위여야 한다.
- 단, 너무 짧거나 어색한 분할은 피하고 다음 길이 제한을 따른다.
  - 최대 길이: 30초

[분할 기준]
- 장면 전환, 화제 변화, 행동 변화, 장소 변화, 시점 변화, 분위기 변화, 사건의 시작/종료를 기준으로 scene을 나눈다.
- 단순히 몇 초마다 기계적으로 자르지 말고, 의미상 자연스럽게 나눈다.
- 불필요하게 잘게 쪼개지 말고, 후속 검색/편집/요약에 유용한 수준으로 분할한다.

[출력 내용]
1. 영상 전체에 대한 한 줄 요약
2. 영상 전체 맥락 설명
3. scene 목록
4. 각 scene마다:
   - scene_id
   - start_time
   - end_time
   - scene_context // 전체 영상에서 이 구간이 무엇? - 맥락
   - scene_summary // 이 구간에 대한 요약
   - key_events
   - visual_cues

[출력 형식]
- 반드시 JSON만 출력한다.
- 마크다운 코드블록을 사용하지 않는다.
- 설명 문장이나 부가 텍스트를 JSON 바깥에 쓰지 않는다.
- time은 초 단위 숫자(float 또는 int)로 출력한다.
- scene_id는 1부터 시작하는 정수다.
- scene들은 시간순으로 정렬한다.
- scene 간 시간은 겹치지 않아야 한다.
- 전체 scene은 영상의 처음부터 끝까지 최대한 빈틈 없이 커버해야 한다.

[JSON 스키마]
{
  "video_summary": "string",
  "video_context": "string",
  "scenes": [
    {
      "scene_id": 1,
      "start_time": 0.0,
      "end_time": 15.0,
      "scene_summary": "장면 한 줄 요약",
      "scene_context": "이 장면이 전체 영상에서 어떤 역할을 하는지 설명",
      "key_events": ["주요 행동1", "주요 행동2"],
      "visual_cues": ["장소", "인물", "화면 변화"]
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
        context = f"[영상 정보]\n총 길이: {duration:.1f}초\n\n"
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
