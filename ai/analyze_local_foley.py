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
from dotenv import load_dotenv

import config
import llm_client
import video_upload

load_dotenv()

GEMINI_API_VIDEO = config.GEMINI_API_VIDEO
GEMINI_MODEL = config.GEMINI_MODEL_FOLEY

PROMPT = """\
You are an analyzer that examines short video scenes and extracts all possible Foley events as comprehensively as possible.

False positives are preferred over false negatives.
Even if confidence is low, extract the event if there is any Foley possibility, and use the confidence value to indicate certainty.

[Input]
Two inputs are provided:
1. A trimmed scene video
2. Metadata about the scene (see [Scene Metadata] below)

[Goal]
Extract all possible Foley events within the scene, as completely as possible, on a per-event basis.

Each event MUST include these fields:
- start_time
- end_time
- peak_time
- category_path
- tags
- description
- confidence

[Key Definitions]
- A Foley event is a concrete action-based sound arising from human movement, body motion, object contact, material friction, food consumption, liquid handling, etc.
- Exclude Music, Dialogue/VO, Ambience, Cinematic, and unrealistic SFX.

[Time Rules]
- All event start_time, peak_time, end_time are relative to the current scene (not the original video).
- Unit is seconds (float). Two decimal places recommended (e.g., 2.45, 0.17).
- For example, if the scene covers 30.0s–45.0s of the original video, output times start from 0.0s within the scene.
- Must satisfy: start_time <= peak_time <= end_time

[Event Splitting Rules]
- Group a single continuous identical action into one event.
- If auditory highlights are clearly distinct, split into separate events.
- Examples:
  - Chewing a carrot multiple times in succession — separate events if each bite is distinguishable.
  - Picking up and setting down a cup — if the sound highlight is the "thud" of setting it down, create one event centered on that moment.
- If a visible action has Foley potential, include it as a candidate even if uncertain.
- Do not create exact duplicate events.

[peak_time Rules]
- peak_time is the instant when the sound is most emphasized in the event.
- Examples:
  - The moment of biting into a carrot
  - The moment a door latches shut
  - The moment a water droplet hits a surface
  - The moment a cup contacts the table

[category_path Rules]
- category_path MUST be a 3-level array: ["Foley", "<Mid>", "<Leaf>"]
- The first element is always "Foley".
- Mid / Leaf MUST be selected only from [taxonomy.json - Foley] below.
- If no exact Leaf matches, select the closest Foley item.

[tags Rules]
- tags is a string array. Maximum 3 items.
- Each tag uses "Mid:Leaf" format (e.g., "Food_Drink:Chew", "Door_Window:Close").
- Match the category_path Mid/Leaf, and optionally include related Foley tags.
- The description should make clear why the chosen category/tags are appropriate.

[confidence Rules]
- confidence is a float between 0.0 and 1.0.
- It indicates certainty level, NOT whether to include or exclude the event.
- Higher when visual evidence and action context are clear.
- Lower when the actual sound is ambiguous or heavily inferred.
- Include the event even if confidence is low, as long as Foley potential exists.
- Approximate scale:
  - 0.85–1.00: Visually clear and the action almost certainly produces sound
  - 0.60–0.84: Reasonably inferable
  - 0.35–0.59: Evidence exists but significant uncertainty
  - 0.10–0.34: Very weak candidate but Foley possibility exists

[Description Rules]
- Write descriptions in English, short and specific.
- Must convey WHAT object, WHAT action, and WHEN the sound occurs.
- Do not include unnecessary subjective commentary.
- Bad:  "Chewing sound"
- Good: "Biting into a raw carrot with a short, crisp crunch at the moment of contact."

[Language]
- All output text (description) MUST be in English.

[Output Rules]
- Output ONLY valid JSON. No markdown code blocks.
- Do not infer information outside the scene.
- Avoid false negatives.
- Extract all actions with Foley potential as completely as possible.
- Return an empty array ONLY when there is absolutely no Foley potential in the scene.

[Output Format]
{
  "scene_id": 1,
  "events": [
    {
      "start_time": 2.28,
      "end_time":   2.62,
      "peak_time":  2.45,
      "category_path": ["Foley", "Food_Drink", "Chew"],
      "tags": ["Food_Drink:Chew"],
      "description": "Biting into a raw carrot with a short, crisp crunch at the moment of contact.",
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


# ---------------------------------------------------------------------------
# 분석
# ---------------------------------------------------------------------------

def analyze_scene(
    client: genai.Client,
    video_path: str,
    scene: dict,
    tmp_dir: str,
) -> dict:
    """scene 하나를 잘라 Gemini File API로 업로드 후 분석. scene 결과 dict 반환."""
    scene_id = scene["scene_id"]
    start = scene["start_time"]
    end = scene["end_time"]
    duration = end - start

    trimmed_path = os.path.join(tmp_dir, f"scene_{scene_id:03d}.mp4")
    with llm_client.start_span(
        "ffmpeg_trim",
        metadata={"scene_id": scene_id, "start": start, "end": end, "duration": duration},
    ):
        trim_video(video_path, start, end, trimmed_path)

    video_file = video_upload.upload_video(client, trimmed_path)

    try:
        scene_meta_str = json.dumps(scene, ensure_ascii=False, indent=2)
        context = (
            f"[Scene Metadata]\n{scene_meta_str}\n\n"
            f"[Video Info]\n"
            f"Scene duration: {duration:.1f}s\n\n"
        )
        prompt = llm_client.get_prompt("foley_analyzer", fallback=PROMPT)
        contents = [context + prompt.text, video_file]

        response = llm_client.generate_content(
            client, model=GEMINI_MODEL, contents=contents,
            stage="foley", scene_id=scene_id, prompt=prompt,
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


def analyze_all(
    video_path: str,
    result_json_path: str,
) -> dict:
    if not GEMINI_API_VIDEO:
        raise EnvironmentError("GEMINI_API_VIDEO가 설정되지 않았습니다. .env 파일을 확인하세요.")

    client = genai.Client(api_key=GEMINI_API_VIDEO)

    global_result = json.loads(Path(result_json_path).read_text(encoding="utf-8"))
    scenes = global_result["scenes"]
    print(f"[info] 총 {len(scenes)}개 scene 분석 시작")

    results = []
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        for scene in scenes:
            scene_id = scene["scene_id"]
            print(f"[scene {scene_id}/{len(scenes)}] {scene['start_time']}s ~ {scene['end_time']}s 분석 중...")
            try:
                result = analyze_scene(client, video_path, scene, tmp)

                # 상대 시간(초) → 절대 시간(초) 변환
                scene_start_sec = float(scene["start_time"])
                for event in result.get("events", []):
                    for k in ("start_time", "peak_time", "end_time"):
                        v = event.get(k)
                        if isinstance(v, (int, float)):
                            event[k] = float(v) + scene_start_sec

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
    parser.add_argument("--out", help="결과를 저장할 JSON 파일 경로 (생략 시 stdout 출력)")
    args = parser.parse_args()

    result = analyze_all(args.video, args.result)

    output = json.dumps(result, ensure_ascii=False, indent=2)

    if args.out:
        Path(args.out).write_text(output, encoding="utf-8")
        print(f"[done] 결과 저장: {args.out}")
    else:
        print(output)


if __name__ == "__main__":
    main()
