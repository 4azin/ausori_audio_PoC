from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


RESULT_FILE_NAMES = {"results.json", "sync_results.json"}
SUPPORTED_AUDIO_ROOTS = {"Foley", "Hard_SFX"}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def iter_audio_result_files(root: Path) -> list[Path]:
    files = []
    for path in root.rglob("*.json"):
        if path.name not in RESULT_FILE_NAMES:
            continue
        lower_path = str(path).lower()
        if "foley" not in lower_path and "hard_sfx" not in lower_path:
            continue
        files.append(path)
    return sorted(files)


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def build_combined_caption(short_caption: str, long_caption: str) -> str:
    short_text = normalize_text(short_caption)
    long_text = normalize_text(long_caption)
    return f"short: {short_text}\nlong: {long_text}"


def infer_source_group(asset_key: str, local_file_path: Path) -> str:
    key = asset_key.lower()
    if key.startswith("foley-"):
        return "foley"
    if key.startswith("hard_sfx-") or key.startswith("sfx-"):
        return "sfx"
    root_name = local_file_path.parts[0] if local_file_path.parts else ""
    if root_name.lower() == "foley":
        return "foley"
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


def normalize_token(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def tokenize_text(value: str) -> set[str]:
    lowered = value.lower()
    chunks = re.split(r"[^a-z0-9]+", lowered)
    return {chunk for chunk in chunks if chunk}


def flatten_json_tokens(data: Any) -> set[str]:
    tokens: set[str] = set()
    if data is None:
        return tokens
    if isinstance(data, dict):
        for key, value in data.items():
            tokens.update(tokenize_text(str(key)))
            tokens.update(flatten_json_tokens(value))
        return tokens
    if isinstance(data, list):
        for item in data:
            tokens.update(flatten_json_tokens(item))
        return tokens
    tokens.update(tokenize_text(str(data)))
    return tokens
