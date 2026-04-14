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


load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

PROMPT = """\
당신은 영상 분석가이자 사운드 디렉터다.
입력된 영상 전체를 먼저 이해한 뒤, 영상의 흐름을 기준으로 장면(scene)을 분할하고,
각 scene에 대해 taxonomy.json 기반 오디오 추천 태그를 생성하라.

[목표]

전체 영상을 여러 개의 scene으로 나눈다.
각 scene은 하나의 의미 있는 맥락 단위여야 한다.
각 scene마다 영상 내용에 맞는 오디오 설계 정보를 함께 생성한다.
오디오 설계 정보는 반드시 제공된 taxonomy 체계 안에서만 선택한다.

[장면 분할 규칙]

장면 전환, 화제 변화, 행동 변화, 장소 변화, 시점 변화, 분위기 변화, 사건의 시작/종료를 기준으로 scene을 나눈다.
단순히 몇 초마다 기계적으로 자르지 말고, 의미상 자연스럽게 나눈다.
불필요하게 잘게 쪼개지 말고, 후속 검색/편집/요약/사운드 배치에 유용한 수준으로 분할한다.
각 scene 길이는 다음을 따른다.
최소 길이: 5초
최대 길이: 30초

[오디오 태깅 규칙]

각 scene에 대해 다음 6개 오디오 축을 검토한다.
Ambience
Cinematic
Dialogue_VO
Foley
SFX
Music
각 축마다:
해당 scene에 필요 없으면 빈 배열 [] 로 둔다.
필요하면 taxonomy 안의 값만 사용한다.
자유 텍스트 장르명, 임의의 새 라벨, taxonomy 밖 용어를 만들지 않는다.
각 오디오 추천 항목은 반드시 다음 3단계 구조를 따른다:
category_key
mid
leaf

예:
{
"category_key": "Music",
"mid": "BGM",
"leaf": "Lo_fi"
}

[음악 선택 원칙]

Music은 배경음악 또는 스코어 관점에서 추천한다.
Cinematic은 장면 전환, 긴장, 강조, 임팩트 보강용 사운드로 추천한다.
Ambience는 공간감/환경음 보강용으로 추천한다.
Foley는 동작, 접촉, 생활 물성 소리 보강용으로 추천한다.
SFX는 UI, 임팩트, 전자음, 효과음, 특수 상황 보강용으로 추천한다.
Dialogue_VO는 해당 scene에 대화/나레이션/방송/합성음성이 핵심일 때만 추천한다.

[중요 제약]

taxonomy에 없는 값은 절대 출력하지 않는다.
scene의 시각적/행동적 맥락을 바탕으로 추천한다.
단순히 많이 추천하지 말고, 실제 편집에 유효한 것만 추천한다.
Music만 고르지 말고, 필요한 경우 Ambience / Foley / SFX / Cinematic도 함께 설계한다.
scene 분위기에 맞지 않는 과한 효과 추천은 피한다.
대사 전달이 중요한 scene이면 Music보다 Dialogue/Roomtone/잔잔한 Ambience를 우선 고려한다.
전환 구간이면 Cinematic/Transition/Whoosh/Hit 등을 우선 검토할 수 있다.
감정 고조나 클라이맥스에서는 Music + Cinematic의 조합을 고려할 수 있다.

[출력 내용]

영상 전체에 대한 한 줄 요약
영상 전체 맥락 설명
scene 목록
각 scene마다:
scene_id
start_time
end_time
scene_context
scene_summary
key_events
visual_cues
audio_plan

[audio_plan 구조]

audio_plan은 아래 키를 가진 객체다:
ambience
cinematic
dialogue_vo
foley
sfx
music
audio_rationale
ambience, cinematic, dialogue_vo, foley, sfx, music 은 각각 배열이다.
배열 원소는 반드시 아래 구조를 따른다:
category_key
mid
leaf
audio_rationale은 왜 이런 오디오 구성이 적절한지 짧게 설명한다.

[출력 형식]

반드시 JSON만 출력한다.
마크다운 코드블록을 사용하지 않는다.
설명 문장이나 부가 텍스트를 JSON 바깥에 쓰지 않는다.
time은 초 단위 숫자(float 또는 int)로 출력한다.
scene_id는 1부터 시작하는 정수다.
scene들은 시간순으로 정렬한다.
scene 간 시간은 겹치지 않아야 한다.
전체 scene은 영상의 처음부터 끝까지 최대한 빈틈 없이 커버해야 한다.

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
"visual_cues": ["장소", "인물", "화면 변화"],
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
"audio_rationale": "실내 설명형 장면으로, 과한 효과음보다 잔잔한 배경음과 생활 소리가 적합하다."
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
    if not GOOGLE_API_KEY:
        raise EnvironmentError("GOOGLE_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.")

    client = genai.Client(api_key=GOOGLE_API_KEY)

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

    context = f"[영상 정보]\n총 길이: {duration:.1f}초\n프레임 수: {len(frame_parts)}장 (약 {fps}fps 샘플)\n\n"
    contents = [context + PROMPT] + frame_parts

    print(f"[info] Gemini 호출 중... (model={GEMINI_MODEL})")
    response = client.models.generate_content(model=GEMINI_MODEL, contents=contents)

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
