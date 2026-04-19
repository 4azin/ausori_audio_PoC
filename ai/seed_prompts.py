"""로컬 PROMPT 상수를 Langfuse Prompts 로 업로드/동기화.

사용법:
    # ai/.env 에 LANGFUSE_* 세팅 되어있어야 함
    python seed_prompts.py                 # 각 프롬프트를 "production" 라벨로 업로드
    python seed_prompts.py --label staging # 라벨 지정
    python seed_prompts.py --dry-run       # 실제 업로드 없이 대상/변경만 출력

동작:
    - 각 analyzer 의 로컬 PROMPT 상수를 읽어 Langfuse 에 새 버전으로 등록.
    - 이름 규약:
        global_analyzer, global_music_analyzer,
        foley_analyzer, non_foley_analyzer
    - `--label` 로 지정한 라벨이 새 버전에 붙는다(기본: production).
    - 동일 내용이면 중복 업로드 방지 (기존 최신 버전과 비교).
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from dataclasses import dataclass

# Langfuse SDK 가 '존재 확인용' 404 도 stderr 로 찍기 때문에, 조회 단계에서는 조용히.
logging.getLogger("langfuse").setLevel(logging.CRITICAL)

from dotenv import load_dotenv

load_dotenv()

import analyze_global
import analyze_global_music
import analyze_local_foley
import analyze_local_non_foley


@dataclass
class PromptSpec:
    name: str
    text: str
    tags: list[str]


PROMPTS: list[PromptSpec] = [
    PromptSpec("global_analyzer",       analyze_global.PROMPT,            ["global", "scene-split"]),
    PromptSpec("global_music_analyzer", analyze_global_music.PROMPT,      ["global", "music"]),
    PromptSpec("foley_analyzer",        analyze_local_foley.PROMPT,       ["local", "foley"]),
    PromptSpec("non_foley_analyzer",    analyze_local_non_foley.PROMPT,   ["local", "non-foley"]),
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", default="production",
                        help="새 버전에 붙일 라벨 (기본: production)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    pk = os.getenv("LANGFUSE_PUBLIC_KEY")
    sk = os.getenv("LANGFUSE_SECRET_KEY")
    host = os.getenv("LANGFUSE_HOST", "http://localhost:3000")
    if not pk or not sk:
        print("[error] LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY 미설정", file=sys.stderr)
        return 2

    try:
        from langfuse import Langfuse
    except ImportError:
        print("[error] langfuse 패키지 필요: pip install -r requirements.txt", file=sys.stderr)
        return 2

    lf = Langfuse(public_key=pk, secret_key=sk, host=host)
    print(f"[info] Langfuse: {host}  label={args.label}  dry_run={args.dry_run}")

    for spec in PROMPTS:
        existing_text = None
        existing_version = None
        try:
            current = lf.get_prompt(spec.name, label=args.label)
            existing_text = current.prompt
            existing_version = getattr(current, "version", None)
        except Exception:
            pass

        if existing_text == spec.text:
            print(f"  [skip] {spec.name}  (v{existing_version} 과 동일)")
            continue

        action = "would create" if args.dry_run else "creating"
        prev = f"v{existing_version}" if existing_version else "없음"
        print(f"  [{action}] {spec.name}  (기존 최신: {prev})")

        if args.dry_run:
            continue

        created = lf.create_prompt(
            name=spec.name,
            type="text",
            prompt=spec.text,
            labels=[args.label],
            tags=spec.tags,
        )
        v = getattr(created, "version", "?")
        print(f"    -> 생성됨 v{v}")

    lf.flush()
    print("[done]")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
