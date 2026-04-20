from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


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
