"""로컬 Non-Foley 분석 — scene별 5개 트랙 배치 결정.

대상 트랙: ambience, music, cinematic, sfx, dialogue_vo
타임스탬프는 초(float) 단위로 처리 (ms 불필요).
겹침 허용 — 여러 트랙이 동시에 존재 가능.

사용법:
    python analyze_local_non_foley.py <video_path> --result result.json
    python analyze_local_non_foley.py <video_path> --result result.json --fps 1 --out non_foley.json
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
GEMINI_MODEL = config.GEMINI_MODEL_NON_FOLEY

PROMPT = """\
You are a professional sound designer who analyzes video scenes and determines Non-Foley sound track placement for each scene.
Rather than simply picking categories, describe concretely as if writing a work order for an actual sound editor.

[Input]
Two inputs are provided:
1. A trimmed scene video
2. Metadata about the scene (see [Scene Metadata] below)

[Target Tracks]
Determine placement for each of the following 5 tracks.
Overlapping tracks are allowed — multiple tracks can exist simultaneously.

1. ambience    — Spatial background sound. Naturally present in the location/environment.
2. music       — BGM, score, jingles, etc.
3. cinematic   — Risers, hits, whooshes, drones, transitions, and other production effects.
4. sfx         — Contextual sound effects. Crowd noise, distant vehicles, spatial emphasis, etc.
                 (Excludes precise action-based sounds like Foley)
5. dialogue_vo — Dialogue, narration, voiceover suggestions.

[Goal]
For each track:
- Determine whether the track is needed in this scene.
- If needed, decide where within the scene to place it.
- If a single track should span multiple segments within the scene, split into multiple items.
- Omit tracks that are not needed.

[Timestamp Rules]
- start_time and end_time are relative to the current scene (not the original video).
- Unit is seconds (float).
- For example, if the scene covers 30.0s–45.0s of the original video, output times start from 0.0s within the scene.
- Millisecond precision is not required. Rough 0.5s granularity is acceptable.

[category_path Rules]
- category_path MUST be selected from [taxonomy - Non-Foley] below.
- Format: ["Major", "Mid", "Leaf"] — 3 levels.
- If no exact Leaf matches, select the closest item.
- Do NOT select Foley items.

[confidence Rules]
- confidence is a float between 0.0 and 1.0.
- Indicates how appropriate the track placement is for this scene.
- 0.85+: Almost certainly needed given the context
- 0.60–0.84: Reasonably fitting
- 0.35–0.59: Optionally considerable
- Below 0.35: Not recommended but possible

[description Rules]
- Describe specifically: what the sound is, why it fits this scene, and its texture/mood.
- Do not end with short generic labels — describe the actual character of the sound.
- Examples:
  - Bad:  "Cafe background sound"
  - Good: "Low murmur of conversations mixed with gentle cup clinking inside a cafe. Creates a cozy, lived-in atmosphere."
  - Bad:  "Lo-fi BGM"
  - Good: "Relaxed drum loop with warm piano chords in a lo-fi style. Emphasizes a comfortable, everyday feeling and gently wraps the entire scene."

[mood Rules]
- mood is 1–3 emotion/atmosphere keywords for this sound.
- Keywords MUST be in English.
- Examples: ["bright", "cheerful"], ["tense", "cold"], ["warm", "cozy"]

[energy Rules]
- energy is the sound's energy level.
- Must be exactly one of: "low" / "medium" / "high"
- low: Calm, sits in the background
- medium: Present but not overwhelming
- high: Intense and foregrounded

[texture Rules]
- texture is the temporal character of the sound.
- Must be exactly one of: "continuous" / "periodic" / "one_shot"
- continuous: Uninterrupted sound (ambience, drone, etc.)
- periodic: Repeating pattern (BGM loop, rhythm, etc.)
- one_shot: Single burst (hit, whoosh, stinger, etc.)

[Language]
- All output text (description, mood) MUST be in English.

[Output Rules]
- Output ONLY valid JSON. No markdown code blocks.
- Do not write any explanatory text outside the JSON.
- Omit unneeded tracks from the tracks array.
- If no tracks are needed, return an empty array.

[Output Format]
{
  "scene_id": 1,
  "tracks": [
    {
      "track": "ambience",
      "start_time": 0.0,
      "end_time": 19.0,
      "category_path": ["Ambience", "Interior", "Cafe"],
      "description": "Low murmur of conversations mixed with gentle cup clinking inside a cafe. Creates a cozy, lived-in spatial presence.",
      "mood": ["cozy", "everyday"],
      "energy": "low",
      "texture": "continuous",
      "confidence": 0.91
    },
    {
      "track": "music",
      "start_time": 0.0,
      "end_time": 19.0,
      "category_path": ["Music", "BGM", "Lo_fi"],
      "description": "Relaxed drum loop with warm piano chords in a lo-fi style. Emphasizes a comfortable, everyday feeling and gently wraps the entire scene.",
      "mood": ["warm", "cheerful"],
      "energy": "low",
      "texture": "periodic",
      "confidence": 0.76
    },
    {
      "track": "cinematic",
      "start_time": 17.5,
      "end_time": 19.0,
      "category_path": ["Cinematic", "Transition", "Swoosh"],
      "description": "A quick swoosh effect just before the scene transition. Audibly emphasizes the cut to the next scene.",
      "mood": ["transitional", "dynamic"],
      "energy": "medium",
      "texture": "one_shot",
      "confidence": 0.62
    }
  ]
}

[taxonomy - Non-Foley]
Ambience:
  Nature: [Forest, Ocean, River, Birds, Insects, Wildlife, Underwater]
  Urban: [City_Traffic, Street, Market, Subway, Sirens, Airport]
  Interior: [Office, Restaurant, Hospital, School, Home, Mall, Bar, Kitchen, Roomtone]
  Exterior: [Park, Parking_Lot, Stadium, Harbor, Highway]
  Weather: [Rain, Thunder, Wind, Snow, Hail, Storm]
  Machine_Room: [Factory, Engine, HVAC, Construction]
  Crowd: [Walla, Children, Sports, Battle, Cheer]
  Designed: [Sci_Fi, Fantasy, Horror, Abstract]

Cinematic:
  Riser: [Short, Long, Reverse, Swell, Tension]
  Hit: [Cinematic, Sub, Orchestral, Hybrid, Trailer, Bass_Drop]
  Whoosh: [Fast, Slow, Flyby, Sweep, Scene_Transition]
  Drone: [Dark, Bright, Evolving, Granular, Noise]
  Stinger: [Orchestra, Synth, Brass, Horror]
  Texture: [Organic, Synthetic, Metallic, Abstract, Industrial]
  Horror: [Scare, Creep, Gore, Creature, Atmosphere]
  Sci_Fi: [Laser, Hologram, Warp, Energy, Robot]
  Tension: [Build, Sustain, Release, Psychological]
  Transition: [Cut, Fade, Swipe, Swoosh, Hit]
  Fantasy: [Magic, Sparkle, Enchant, Portal, Spell]

Dialogue_VO:
  Dialogue: [Conversation, Argument, Whisper]
  Narration: [Documentary, Storytelling, Instructional]
  Crowd_Dialogue: [Walla, Chatter, Murmur]
  Announcement: [Public_Address, Broadcast, Intercom]
  Synthetic: [AI, Robot, Vocoder]

SFX (contextual only — excludes action-based sounds):
  Human: [Breath, Scream, Laugh, Grunt, Cough, Cry]
  Animal: [Dog, Cat, Bird, Horse, Insect, Monster]
  Electronic: [Glitch, Digital, Synth, Alarm, Computer]
  Communication: [Ring, Dial_Tone, Static, Feedback]
  UI: [Click, Beep, Notification, Alert, Error, Hover, Swipe, Success, Level_Up]
  Cartoon: [Boing, Splat, Pop, Squeak, Toy]

Music:
  BGM: [Cinematic, Lo_fi, Electronic, Orchestral, Acoustic, Rock, Jazz, Hip_Hop]
  Jingle: [Intro, Outro, Notification]
  Synth_Pad: [Ambient, Dark, Bright]
  Score: [Orchestral, Electronic, Hybrid]
  Percussion: [Acoustic, Electronic, World]
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
    """scene 하나를 잘라 Gemini File API로 업로드 후 Non-Foley 트랙 배치 분석."""
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
        prompt = llm_client.get_prompt("non_foley_analyzer", fallback=PROMPT)
        contents = [context + prompt.text, video_file]

        response = llm_client.generate_content(
            client, model=GEMINI_MODEL, contents=contents,
            stage="non_foley", scene_id=scene_id, prompt=prompt,
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
                scene_start_sec = scene["start_time"]
                for track in result.get("tracks", []):
                    track["start_time"] += scene_start_sec
                    track["end_time"] += scene_start_sec

                results.append(result)
                print(f"[scene {scene_id}] 트랙 {len(result.get('tracks', []))}개 배치")
            except Exception as e:
                print(f"[scene {scene_id}] 실패: {e}")
                results.append({"scene_id": scene_id, "tracks": [], "error": str(e)})

    return {"scenes": results}


# ---------------------------------------------------------------------------
# 진입점
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="scene별 Non-Foley 트랙 배치 분석 (Gemini)")
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
