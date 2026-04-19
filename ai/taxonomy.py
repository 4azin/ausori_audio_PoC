"""`taxonomy.json` 기반 categoryPath 유효성 검증.

계약 §0-5: `categoryPath` 는 3-depth ([Major, Mid, Sub]). 매칭 실패 시 AI 는
이벤트를 **스킵 + 로그** 하고 파이프라인은 계속 진행한다.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

_TAXONOMY_PATH = Path(__file__).resolve().parent / "taxonomy.json"

# {"Foley": {"Food_Drink": {"Chew", "Sip", ...}, ...}, ...}
_INDEX: dict[str, dict[str, set[str]]] | None = None


def _load() -> dict[str, dict[str, set[str]]]:
    global _INDEX
    if _INDEX is not None:
        return _INDEX
    raw = json.loads(_TAXONOMY_PATH.read_text(encoding="utf-8"))
    index: dict[str, dict[str, set[str]]] = {}
    for cat in raw.get("categories", []):
        major = cat["key"]
        mids = cat.get("mids", {}) or {}
        index[major] = {mid: set(leaves) for mid, leaves in mids.items()}
    _INDEX = index
    return index


def is_valid_category_path(path: Iterable[str] | None) -> bool:
    if not path:
        return False
    parts = list(path)
    if len(parts) != 3:
        return False
    major, mid, sub = parts
    index = _load()
    return sub in index.get(major, {}).get(mid, set())


def reason_invalid(path: Iterable[str] | None) -> str:
    """유효하지 않은 경로의 원인을 간단히 설명 (로그용)."""
    if not path:
        return "empty"
    parts = list(path)
    if len(parts) != 3:
        return f"depth={len(parts)} (expected 3)"
    major, mid, sub = parts
    index = _load()
    if major not in index:
        return f"unknown major '{major}'"
    if mid not in index[major]:
        return f"unknown mid '{major}/{mid}'"
    if sub not in index[major][mid]:
        return f"unknown sub '{major}/{mid}/{sub}'"
    return "ok"
