"""로컬 Foley 분석 — scene별 잘린 영상 + 메타데이터로 Gemini 분석.

사용법:
    python analyze_local_foley.py <video_path> --result result.json
    python analyze_local_foley.py <video_path> --result result.json --fps 2 --out foley.json
"""

import argparse
import json
import os
import subprocess
import tempfile
from pathlib import Path

from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-pro-preview")

PROMPT = """\
당신은 짧게 분할된 영상 scene을 분석하여, 해당 scene 안에서 발생했을 가능성이 있는 Foley 이벤트를 가능한 한 빠짐없이 구조화하는 분석기다.

과소검출(false negative)보다 과검출(false positive)이 더 낫다.
확신이 낮더라도 Foley 가능성이 있으면 일단 추출하고, confidence 값으로 확신 정도를 구분하라.

[입력]
입력으로는 2가지가 주어진다.
1. 잘린 scene 영상 (프레임 시퀀스)
2. 해당 scene에 대한 메타 정보 (아래 [Scene 메타데이터] 참고)

[목표]
scene 내부에서 발생했을 가능성이 있는 Foley 이벤트를 이벤트 단위로 최대한 빠짐없이 추출하라.

각 이벤트마다 반드시 아래 필드를 포함하라:
- event_id
- peak_time
- start_time
- end_time
- event_category
- event_tags
- description
- confidence

[중요 정의]
- Foley 이벤트는 사람의 동작, 신체 움직임, 사물 접촉, 재질 마찰, 음식 섭취, 액체 취급 등에서 발생하는 구체적 행위성 소리다.
- Music, Dialogue/VO, Ambience, Cinematic, 일반적인 비현실적 SFX는 제외한다.
- event_category는 항상 "foley"여야 한다.

[시간 규칙]
- 모든 event의 start_time, peak_time, end_time은 "현재 입력된 scene 내부 기준 상대 시간"으로 출력한다.
- 단위는 ms(밀리초) 정수다.
- 예를 들어 scene이 원본 영상의 30.0초~45.0초 구간이어도, 출력 시간은 scene 내부 0ms부터 계산한다.
- 반드시 다음을 만족해야 한다:
  start_time <= peak_time <= end_time

[이벤트 분할 규칙]
- 하나의 연속된 동일 행위는 하나의 이벤트로 묶는다.
- 청각적으로 하이라이트가 분명히 다르면 별도 이벤트로 분리한다.
- 예:
  - 당근을 여러 번 연속으로 씹으면, 각 깨무는 순간이 구분될 경우 separate event 가능
  - 컵을 집고 내려놓는 과정에서 실제 소리 하이라이트가 "탁" 내려놓는 순간이면 그 중심으로 하나의 event 생성
- 보이는 행위 중 Foley 가능성이 있으면, 확실하지 않더라도 후보 이벤트로 포함하라.
- 단, 완전히 동일한 이벤트를 중복 생성하지는 마라.

[peak_time 규칙]
- peak_time은 그 이벤트에서 소리가 가장 강조되는 찰나의 시점이다.
- 예:
  - 당근을 깨무는 순간
  - 문이 닫히며 맞닿는 순간
  - 물방울이 표면에 닿는 순간
  - 컵이 테이블에 닿는 순간

[event_tags 규칙]
- event_tags는 taxonomy.json의 Foley 카테고리에서만 선택한다.
- 최대 3개까지 선택한다.
- 태그 형식은 반드시 "Mid:Leaf" 형식으로 출력한다.
- 예:
  - "Food_Drink:Chew"
  - "Door_Window:Close"
  - "Object:Cup_Glass"
  - "Liquid:Pour"
- taxonomy에 완전히 정확한 태그가 없으면, 가장 가까운 Foley 태그를 선택한다.
- 설명(description)에는 왜 그 태그를 선택했는지 드러나도록 구체적으로 쓴다.

[confidence 규칙]
- confidence는 0.0 ~ 1.0 사이의 실수다.
- confidence는 이벤트를 제외할지 말지를 결정하는 기준이 아니라, 추출된 이벤트의 확신 정도를 표시하는 값이다.
- 시각적 근거와 행위 맥락이 명확할수록 높다.
- 실제 소리가 불분명하거나 추론 비중이 크면 낮춘다.
- 신뢰도가 낮더라도 Foley 가능성이 있으면 이벤트를 생략하지 말고 포함하라.
- 대략적인 기준:
  - 0.85~1.00: 시각적으로도 명확하고 행위상 소리가 거의 확실함
  - 0.60~0.84: 합리적으로 추정 가능함
  - 0.35~0.59: 근거는 있으나 불확실성이 큼
  - 0.10~0.34: 매우 약한 후보지만 Foley 가능성은 있음

[설명 작성 규칙]
- description은 짧고 구체적으로 작성한다.
- "무엇이", "어떤 동작으로", "어느 순간 소리가 나는지"가 드러나야 한다.
- 불필요한 감상 표현은 넣지 마라.

[출력 규칙]
- 반드시 JSON만 출력한다.
- event_id는 "E1", "E2", "E3" 형식으로 순서대로 부여한다.
- scene 바깥의 정보는 추정하지 마라.
- 과소검출(false negative)을 피하라.
- scene 안에서 Foley 가능성이 보이는 행위는 가능한 한 빠짐없이 추출하라.
- 빈 배열은 scene 안에 의미 있는 Foley 가능성이 전혀 없을 때만 반환하라.

[출력 형식]
{
  "scene_id": 1,
  "events": [
    {
      "event_id": "E1",
      "peak_time": 2450,
      "start_time": 2280,
      "end_time": 2620,
      "event_category": "foley",
      "event_tags": ["Food_Drink:Chew"],
      "description": "생당근을 한입 베어 무는 순간 짧고 단단한 씹는 소리가 발생하는 이벤트.",
      "confidence": 0.93
    }
  ]
}

[taxonomy.json - Foley]
{
  "Footsteps": ["Concrete", "Wood", "Gravel", "Grass", "Metal", "Carpet", "Tile", "Snow", "Mud", "Sand"],
  "Cloth": ["Jacket", "Dress", "Denim", "Leather", "Nylon"],
  "Door_Window": ["Open", "Close", "Knock", "Creak", "Slide"],
  "Object": ["Cup_Glass", "Paper", "Plastic", "Metal", "Wood", "Box", "Bag", "Key"],
  "Body": ["Clap", "Snap", "Slap", "Stomp", "Fall", "Jump"],
  "Furniture": ["Chair", "Drawer", "Cabinet", "Table"],
  "Food_Drink": ["Chew", "Sip", "Pour", "Swallow", "Bottle"],
  "Liquid": ["Pour", "Splash", "Drip", "Bubble"],
  "Material_Texture": ["Friction", "Scrape", "Shatter", "Crumple", "Crack", "Ice"],
  "Writing": ["Pen", "Pencil", "Keyboard", "Chalk"]
}
"""


# ---------------------------------------------------------------------------
# ffmpeg 유틸
# ---------------------------------------------------------------------------

def trim_video(video_path: str, start_sec: float, end_sec: float, out_path: str) -> None:
    """ffmpeg으로 start~end 구간을 잘라 out_path에 저장."""
    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start_sec),
        "-to", str(end_sec),
        "-i", video_path,
        "-c", "copy",
        out_path,
    ]
    subprocess.run(cmd, capture_output=True, check=True)


def extract_frames(video_path: str, fps: float, max_frames: int, out_dir: str) -> list[str]:
    """ffmpeg으로 프레임 추출. 추출된 이미지 경로 목록 반환."""
    pattern = os.path.join(out_dir, "frame_%04d.jpg")
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vf", f"fps={fps},scale=768:-2",
        "-q:v", "3",
        pattern,
    ]
    subprocess.run(cmd, capture_output=True, check=True)

    frames = sorted(Path(out_dir).glob("frame_*.jpg"))

    if len(frames) > max_frames:
        step = len(frames) / max_frames
        frames = [frames[int(i * step)] for i in range(max_frames)]

    return [str(f) for f in frames]


def load_frames_as_parts(frame_paths: list[str]) -> list:
    """프레임 파일을 bytes로 읽어 Gemini Part 목록으로 반환 (Windows 파일 락 방지)."""
    parts = []
    for p in frame_paths:
        with open(p, "rb") as f:
            data = f.read()
        parts.append(types.Part.from_bytes(data=data, mime_type="image/jpeg"))
    return parts


# ---------------------------------------------------------------------------
# 분석
# ---------------------------------------------------------------------------

def analyze_scene(
    client: genai.Client,
    video_path: str,
    scene: dict,
    fps: float,
    max_frames: int,
    tmp_dir: str,
) -> dict:
    """scene 하나를 잘라 Gemini로 분석. scene 결과 dict 반환."""
    scene_id = scene["scene_id"]
    start = scene["start_time"]
    end = scene["end_time"]
    duration = end - start

    trimmed_path = os.path.join(tmp_dir, f"scene_{scene_id:03d}.mp4")
    trim_video(video_path, start, end, trimmed_path)

    frame_dir = os.path.join(tmp_dir, f"frames_{scene_id:03d}")
    os.makedirs(frame_dir, exist_ok=True)
    frame_paths = extract_frames(trimmed_path, fps, max_frames, frame_dir)
    frame_parts = load_frames_as_parts(frame_paths)

    scene_meta_str = json.dumps(scene, ensure_ascii=False, indent=2)
    context = (
        f"[Scene 메타데이터]\n{scene_meta_str}\n\n"
        f"[영상 정보]\n"
        f"scene 길이: {duration:.1f}초\n"
        f"프레임 수: {len(frame_parts)}장 (약 {fps}fps 샘플)\n\n"
    )
    contents = [context + PROMPT] + frame_parts

    response = client.models.generate_content(model=GEMINI_MODEL, contents=contents)
    raw = response.text.strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    return json.loads(raw)


def analyze_all(
    video_path: str,
    result_json_path: str,
    fps: float = 2.0,
    max_frames: int = 30,
) -> dict:
    if not GOOGLE_API_KEY:
        raise EnvironmentError("GOOGLE_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.")

    client = genai.Client(api_key=GOOGLE_API_KEY)

    global_result = json.loads(Path(result_json_path).read_text(encoding="utf-8"))
    scenes = global_result["scenes"]
    print(f"[info] 총 {len(scenes)}개 scene 분석 시작")

    results = []
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        for scene in scenes:
            scene_id = scene["scene_id"]
            print(f"[scene {scene_id}/{len(scenes)}] {scene['start_time']}s ~ {scene['end_time']}s 분석 중...")
            try:
                result = analyze_scene(client, video_path, scene, fps, max_frames, tmp)

                # 상대 시간(ms) → 절대 시간(ms) 변환
                scene_start_ms = int(scene["start_time"] * 1000)
                for event in result.get("events", []):
                    event["start_time"] += scene_start_ms
                    event["peak_time"] += scene_start_ms
                    event["end_time"] += scene_start_ms

                results.append(result)
                print(f"[scene {scene_id}] 이벤트 {len(result.get('events', []))}개 추출")
            except Exception as e:
                print(f"[scene {scene_id}] 실패: {e}")
                results.append({"scene_id": scene_id, "events": [], "error": str(e)})

    return {"scenes": results}


# ---------------------------------------------------------------------------
# 진입점
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="scene별 Foley 분석 (Gemini)")
    parser.add_argument("video", help="원본 영상 파일 경로")
    parser.add_argument("--result", required=True, help="글로벌 분석 결과 JSON 경로 (result.json)")
    parser.add_argument("--fps", type=float, default=2.0, help="프레임 추출 fps (기본: 2.0)")
    parser.add_argument("--max-frames", type=int, default=30, help="scene당 최대 프레임 수 (기본: 30)")
    parser.add_argument("--out", help="결과를 저장할 JSON 파일 경로 (생략 시 stdout 출력)")
    args = parser.parse_args()

    result = analyze_all(args.video, args.result, fps=args.fps, max_frames=args.max_frames)

    output = json.dumps(result, ensure_ascii=False, indent=2)

    if args.out:
        Path(args.out).write_text(output, encoding="utf-8")
        print(f"[done] 결과 저장: {args.out}")
    else:
        print(output)


if __name__ == "__main__":
    main()
