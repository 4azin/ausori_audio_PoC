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
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-pro-preview")

PROMPT = """\
당신은 영상 scene을 분석하여, 해당 scene에 어울리는 Non-Foley 사운드 트랙 배치를 결정하는 사운드 디자이너다.

[입력]
입력으로는 2가지가 주어진다.
1. 잘린 scene 영상 (프레임 시퀀스)
2. 해당 scene에 대한 메타 정보 (아래 [Scene 메타데이터] 참고)

[분석 대상 트랙]
아래 5개 트랙에 대해 각각 배치 여부와 구간을 결정하라.
트랙 간 겹침은 허용된다. 동시에 여러 트랙이 존재할 수 있다.

1. ambience  — 공간 배경음. 장소/환경에서 자연스럽게 깔리는 소리.
2. music     — BGM, 스코어, 징글 등.
3. cinematic — 라이저, 히트, 우쉬, 드론, 트랜지션 등 연출용 효과.
4. sfx       — 맥락형 효과음. 군중 소리, 먼 차량, 공간 강조 효과 등.
               (Foley처럼 정밀한 행위성 소리는 제외)
5. dialogue_vo — 대화, 나레이션, 보이스오버 제안.

[목표]
각 트랙에 대해:
- 이 scene에서 해당 트랙이 필요한지 판단하라.
- 필요하다면 scene 내 어느 구간에 배치할지 결정하라.
- 하나의 트랙이 scene 내에서 여러 구간으로 나뉠 수 있다면 복수 항목으로 분리하라.
- 필요 없는 트랙은 출력에서 생략하라.

[타임스탬프 규칙]
- start_time, end_time은 "현재 입력된 scene 내부 기준 상대 시간"으로 출력한다.
- 단위는 초(float)다.
- 예를 들어 scene이 원본 영상의 30.0초~45.0초 구간이어도,
  출력 시간은 scene 내부 0.0초부터 계산한다.
- 정밀한 ms 단위까지 맞출 필요 없다. 0.5초 단위로 러프하게 표기해도 된다.

[category_path 규칙]
- category_path는 반드시 아래 [taxonomy - Non-Foley] 에서 선택한다.
- 형식: ["대분류", "Mid", "Leaf"] — 3단계로 표기한다.
- 정확한 Leaf가 없으면 가장 가까운 항목을 선택한다.
- Foley 항목은 선택하지 마라.

[confidence 규칙]
- confidence는 0.0 ~ 1.0 사이 실수다.
- 이 scene에서 해당 트랙 배치가 얼마나 적절한지를 나타낸다.
- 0.85 이상: 맥락상 거의 확실히 필요함
- 0.60~0.84: 합리적으로 어울림
- 0.35~0.59: 선택적으로 고려 가능
- 0.35 미만: 권장하지 않지만 가능성은 있음

[description 규칙]
- 짧고 구체적으로 쓴다.
- 어떤 소리가 왜 이 장면에 어울리는지 드러나야 한다.

[출력 규칙]
- 반드시 JSON만 출력한다.
- 마크다운 코드블록을 사용하지 않는다.
- 설명 문장이나 부가 텍스트를 JSON 바깥에 쓰지 않는다.
- 필요 없는 트랙은 tracks 배열에서 생략한다.
- tracks가 하나도 없으면 빈 배열을 반환한다.

[출력 형식]
{
  "scene_id": 1,
  "tracks": [
    {
      "track": "ambience",
      "start_time": 0.0,
      "end_time": 19.0,
      "category_path": ["Ambience", "Interior", "Cafe"],
      "description": "카페 실내의 잔잔한 배경 생활음",
      "confidence": 0.91
    },
    {
      "track": "music",
      "start_time": 0.0,
      "end_time": 19.0,
      "category_path": ["Music", "BGM", "Lo_fi"],
      "description": "밝고 경쾌한 분위기의 로파이 BGM",
      "confidence": 0.76
    },
    {
      "track": "cinematic",
      "start_time": 17.5,
      "end_time": 19.0,
      "category_path": ["Cinematic", "Transition", "Swoosh"],
      "description": "장면 전환 직전 짧은 우쉬 효과",
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

SFX (맥락형만 — 행위성 소리 제외):
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
    """scene 하나를 잘라 Gemini로 Non-Foley 트랙 배치 분석. scene 결과 dict 반환."""
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
    fps: float = 1.0,
    max_frames: int = 20,
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
    parser.add_argument("--fps", type=float, default=1.0, help="프레임 추출 fps (기본: 1.0)")
    parser.add_argument("--max-frames", type=int, default=20, help="scene당 최대 프레임 수 (기본: 20)")
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
