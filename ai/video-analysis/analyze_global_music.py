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
import tempfile
from pathlib import Path

from google import genai
from google.genai import types
from dotenv import load_dotenv

import config
import llm_client


load_dotenv()

GEMINI_API_VIDEO = config.GEMINI_API_VIDEO
GEMINI_MODEL = config.GEMINI_MODEL_GLOBAL_MUSIC

PROMPT = """\
You are a video analyst and sound director.
Watch the entire input video first, then split it into scenes based on the video's flow,
and generate taxonomy-based audio recommendation tags for each scene.

[Goal]

Split the entire video into multiple scenes.
Each scene must be a single meaningful contextual unit.
Generate audio design information matching the video content for each scene.
Audio design information MUST be selected only from the provided taxonomy.

[Scene Splitting Rules]

Split on scene transitions, topic changes, action changes, location changes, perspective shifts, mood changes, or the start/end of events.
Do not mechanically cut every few seconds — split naturally by meaning.
Do not over-segment. Split at a granularity useful for downstream search, editing, summarization, and sound placement.
Each scene length must follow:
Minimum length: 5 seconds
Maximum length: 30 seconds

[Audio Tagging Rules]

For each scene, evaluate the following 6 audio axes:
Ambience
Cinematic
Dialogue_VO
Foley
SFX
Music
For each axis:
If not needed for the scene, use an empty array [].
If needed, use ONLY values from the taxonomy.
Do not invent free-text genre names, arbitrary labels, or terms outside the taxonomy.
Each audio recommendation item MUST follow this 3-level structure:
category_key
mid
leaf

Example:
{
"category_key": "Music",
"mid": "BGM",
"leaf": "Lo_fi"
}

[Audio Selection Principles]

Music: Recommend from a BGM or score perspective.
Cinematic: Recommend for scene transitions, tension, emphasis, or impact reinforcement.
Ambience: Recommend for spatial presence and environmental sound reinforcement.
Foley: Recommend for action, contact, and material interaction sounds.
SFX: Recommend for UI, impact, electronic, effect, or special situation sounds.
Dialogue_VO: Recommend ONLY when dialogue, narration, broadcast, or synthetic voice is central to the scene.

[Important Constraints]

NEVER output values that are not in the taxonomy.
Base recommendations on the visual and behavioral context of the scene.
Do not over-recommend — only suggest what would be genuinely useful in actual editing.
Do not only pick Music — design Ambience / Foley / SFX / Cinematic as well when appropriate.
Avoid excessive effects that do not match the scene's mood.
If dialogue delivery is important, prioritize Dialogue/Roomtone/subtle Ambience over Music.
For transition segments, consider Cinematic/Transition/Whoosh/Hit first.
For emotional climaxes, consider Music + Cinematic combinations.

[Output Content]

One-line summary of the entire video
Overall context description of the video
List of scenes
For each scene:
scene_id
start_time
end_time
scene_context
scene_summary
key_events
visual_cues
audio_plan

[audio_plan Structure]

audio_plan is an object with these keys:
ambience
cinematic
dialogue_vo
foley
sfx
music
audio_rationale
ambience, cinematic, dialogue_vo, foley, sfx, music are each arrays.
Each array element MUST follow this structure:
category_key
mid
leaf
audio_rationale briefly explains why this audio composition is appropriate.

[Language]
- All output text (video_summary, video_context, scene_summary, scene_context, key_events, visual_cues, audio_rationale) MUST be in English.

[Output Format]

Output ONLY valid JSON. No markdown code blocks.
Do not write any explanatory text outside the JSON.
Times are in seconds (float or int).
scene_id starts at 1 (integer).
Scenes must be sorted chronologically.
Scene time ranges must not overlap.
Scenes should cover the video from start to end as completely as possible.

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
"visual_cues": ["Location", "Characters", "Visual transition"],
"audio_plan": {
"ambience": [
{
"category_key": "Ambience",
"mid": "Interior",
"leaf": "Roomtone"
}
],
"cinematic": [],
"dialogue_vo": [],
"foley": [
{
"category_key": "Foley",
"mid": "Writing",
"leaf": "Keyboard"
}
],
"sfx": [],
"music": [
{
"category_key": "Music",
"mid": "BGM",
"leaf": "Lo_fi"
}
],
"audio_rationale": "An indoor explanatory scene where subtle background ambience and everyday sounds are more appropriate than heavy effects."
}
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

    # max_frames 초과 시 균등 샘플링
    if len(frames) > max_frames:
        step = len(frames) / max_frames
        frames = [frames[int(i * step)] for i in range(max_frames)]

    return [str(f) for f in frames]


# ---------------------------------------------------------------------------
# 분석
# ---------------------------------------------------------------------------

def analyze(video_path: str, fps: float = 1.0, max_frames: int = 180) -> dict:
    if not GEMINI_API_VIDEO:
        raise EnvironmentError("GEMINI_API_VIDEO가 설정되지 않았습니다. .env 파일을 확인하세요.")

    client = genai.Client(api_key=GEMINI_API_VIDEO)

    duration = get_duration(video_path)
    print(f"[info] 영상 길이: {duration:.1f}초")

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        print(f"[info] 프레임 추출 중... (fps={fps}, max={max_frames})")
        frame_paths = extract_frames(video_path, fps, max_frames, tmp)
        print(f"[info] 추출된 프레임: {len(frame_paths)}장")

        # Windows 파일 락 방지: bytes로 미리 읽고 파일 핸들 닫기
        frame_parts = []
        for p in frame_paths:
            with open(p, "rb") as f:
                data = f.read()
            frame_parts.append(types.Part.from_bytes(data=data, mime_type="image/jpeg"))

    context = f"[Video Info]\nDuration: {duration:.1f}s\nFrames: {len(frame_parts)} (approx {fps}fps sample)\n\n"
    prompt = llm_client.get_prompt("global_music_analyzer", fallback=PROMPT)
    contents = [context + prompt.text] + frame_parts

    print(f"[info] Gemini 호출 중... (model={GEMINI_MODEL}, prompt={prompt.name}@{prompt.version}/{prompt.source})")
    response = llm_client.generate_content(
        client, model=GEMINI_MODEL, contents=contents, stage="global_music", prompt=prompt,
    )

    raw = response.text.strip()

    # 혹시 코드블록이 섞여 들어온 경우 제거
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
    parser.add_argument("--fps", type=float, default=1.0, help="프레임 추출 fps (기본: 1.0)")
    parser.add_argument("--max-frames", type=int, default=180, help="최대 프레임 수 (기본: 180)")
    parser.add_argument("--out", help="결과를 저장할 JSON 파일 경로 (생략 시 stdout 출력)")
    args = parser.parse_args()

    result = analyze(args.video, fps=args.fps, max_frames=args.max_frames)

    output = json.dumps(result, ensure_ascii=False, indent=2)

    if args.out:
        Path(args.out).write_text(output, encoding="utf-8")
        print(f"[done] 결과 저장: {args.out}")
    else:
        print(output)


if __name__ == "__main__":
    main()
