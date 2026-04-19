"""Configuration — audio-classify pipeline.

Loads environment variables and exposes typed constants used by every module.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# .env 우선, 상위 .env 도 fallback
load_dotenv(Path(__file__).parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env")

# ── Google API ──────────────────────────────────────────────
GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")

# ── Model IDs ───────────────────────────────────────────────
# §4.1  Gemma 4 family — classification / caption / tag
CAPTION_MODEL: str = os.getenv("CAPTION_MODEL", "gemma-4-multimodal")

# §4.2  Gemini Embedding 2 — text + audio embeddings
EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "gemini-embedding-2-preview")

# Embedding dimensionality (768 / 1536 / 3072)
EMBEDDING_DIM: int = int(os.getenv("EMBEDDING_DIM", "768"))

# ── Database ────────────────────────────────────────────────
DB_PATH: str = os.getenv("DB_PATH", str(Path(__file__).parent / "audio_classify.db"))

# ── Sound library ───────────────────────────────────────────
SOUND_LIBRARY_ROOT: str = os.getenv(
    "SOUND_LIBRARY_ROOT", str(Path(__file__).parent / "sample_data")
)

# ── Retrieval tuning ───────────────────────────────────────
TOP_K_CANDIDATES: int = int(os.getenv("TOP_K_CANDIDATES", "50"))

# §10  Scoring weights — Stage 1
W_CLASS: float = 0.15
W_TAG: float = 0.20
W_TEXT_TEXT: float = 0.50
W_SPARSE: float = 0.15

# §10  Scoring weights — Final
W_STAGE1: float = 0.65
W_TEXT_AUDIO: float = 0.35

# §11.2  Tag score sub-weights
W_TAG_UPSTREAM: float = 0.35
W_TAG_REWRITTEN: float = 0.65

# §16.3  Confidence thresholds
THRESHOLD_STRONG: float = 0.80
THRESHOLD_USABLE: float = 0.65

# ── Taxonomy ────────────────────────────────────────────────
TAXONOMY_PATH: str = str(Path(__file__).parent.parent / "taxonomy.json")

# ── Category adjacency map  (§11.1) ────────────────────────
# exact → 1.0, adjacent → 0.6, weakly related → 0.2
CATEGORY_ADJACENCY: dict[str, dict[str, float]] = {
    "foley": {"foley": 1.0, "sfx": 0.6, "ambience": 0.2, "cinematic": 0.2, "music": 0.0, "dialogue_vo": 0.0},
    "sfx": {"sfx": 1.0, "foley": 0.6, "cinematic": 0.6, "ambience": 0.2, "music": 0.2, "dialogue_vo": 0.0},
    "ambience": {"ambience": 1.0, "foley": 0.2, "sfx": 0.2, "cinematic": 0.2, "music": 0.2, "dialogue_vo": 0.2},
    "cinematic": {"cinematic": 1.0, "sfx": 0.6, "music": 0.6, "ambience": 0.2, "foley": 0.2, "dialogue_vo": 0.0},
    "music": {"music": 1.0, "cinematic": 0.6, "ambience": 0.2, "sfx": 0.2, "foley": 0.0, "dialogue_vo": 0.0},
    "dialogue_vo": {"dialogue_vo": 1.0, "ambience": 0.2, "foley": 0.0, "sfx": 0.0, "cinematic": 0.0, "music": 0.0},
}
