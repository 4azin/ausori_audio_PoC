from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


RESULT_FILE_NAMES = {"results.json", "sync_results.json"}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def iter_audio_result_files(root: Path) -> list[Path]:
    files = []
    for path in root.rglob("*.json"):
        if path.name not in RESULT_FILE_NAMES:
            continue
        files.append(path)
    return sorted(files)


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def build_combined_caption(short_caption: str, long_caption: str) -> str:
    short_text = normalize_text(short_caption)
    long_text = normalize_text(long_caption)
    return f"short: {short_text}\nlong: {long_text}"


def infer_source_group(asset_key: str, source_path: str | Path | None = None) -> str:
    key = asset_key.lower()
    if key.startswith("ambience-"):
        return "ambience"
    if key.startswith("cinematic-"):
        return "cinematic"
    if key.startswith("dialogue_vo-") or key.startswith("dialogue-"):
        return "dialogue_vo"
    if key.startswith("foley-"):
        return "foley"
    if key.startswith("hard_sfx-") or key.startswith("sfx-"):
        return "sfx"
    if key.startswith("music-"):
        return "music"

    source_text = str(source_path or "").lower()
    if "ambience" in source_text:
        return "ambience"
    if "cinematic" in source_text:
        return "cinematic"
    if "dialogue_vo" in source_text or "dialogue" in source_text:
        return "dialogue_vo"
    if "foley" in source_text:
        return "foley"
    if "hard_sfx" in source_text or "sfx" in source_text:
        return "sfx"
    if "music" in source_text:
        return "music"
    return "sfx"


def split_relative_parts(relative_path: Path) -> tuple[str | None, str | None, str | None]:
    parts = relative_path.parts
    if not parts:
        return None, None, None
    major = parts[0] if len(parts) >= 1 else None
    middle = parts[1] if len(parts) >= 2 else None
    sub = parts[2] if len(parts) >= 3 else None
    return major, middle, sub


def to_vector_literal(values: list[float]) -> str:
    return "[" + ",".join(f"{value:.10f}" for value in values) + "]"

