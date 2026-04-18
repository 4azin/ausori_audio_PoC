"""Data models — mirrors the spec §5, §6, §14 exactly.

All field names, types, and structures follow the engineering specification.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── §6  Structured tags ────────────────────────────────────
class StructuredTags(BaseModel):
    """Structured tag categories extracted from audio or caption."""

    object: list[str] = Field(default_factory=list)
    action: list[str] = Field(default_factory=list)
    material: list[str] = Field(default_factory=list)
    texture: list[str] = Field(default_factory=list)
    environment: list[str] = Field(default_factory=list)
    temporal: list[str] = Field(default_factory=list)
    editorial_role: list[str] = Field(default_factory=list)
    realism: str = ""
    mood: list[str] = Field(default_factory=list)
    intensity: list[str] = Field(default_factory=list)


# ── §6  Asset data model ───────────────────────────────────
class AudioAsset(BaseModel):
    """Complete sound asset record — §6 Required fields."""

    asset_id: str
    original_filename: str
    normalized_title: str = ""
    duration_ms: int = 0
    sample_rate: int = 0
    channels: int = 0
    storage_uri: str = ""

    # Classification
    primary_class: str = ""
    secondary_candidates: list[str] = Field(default_factory=list)
    class_confidence: float = 0.0

    # Captions
    short_caption_en: str = ""
    long_caption_en: str = ""

    # Tags
    tags_structured: StructuredTags = Field(default_factory=StructuredTags)

    # Embeddings — stored separately in DB, kept as optional here
    text_embedding: list[float] | None = None
    audio_embedding: list[float] | None = None

    # Versioning  (§7.2 E)
    embedding_model_version: str = ""
    caption_model_version: str = ""

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ── §5  Input event from upstream ──────────────────────────
class EventQuery(BaseModel):
    """Input event JSON from the upstream video-analysis AI — §5."""

    event_id: str
    peak_time: int | float = 0
    start_time: int | float = 0
    end_time: int | float = 0
    event_category: str = ""
    event_tags: list[str] = Field(default_factory=list)
    description: str = ""
    confidence: float = 0.0


# ── §8  Normalized query  ──────────────────────────────────
class NormalizedQuery(BaseModel):
    """Result of query processing — §8.1."""

    event_id: str
    query_class: str = ""
    query_description_raw: str = ""
    query_description_en: str = ""
    query_tags_upstream: list[str] = Field(default_factory=list)
    query_tags_rewritten: StructuredTags = Field(default_factory=StructuredTags)
    query_embedding_text: list[float] | None = None


# ── §14  Score breakdown ───────────────────────────────────
class ScoreBreakdown(BaseModel):
    """Individual score component values — §10–§11."""

    class_score: float = 0.0
    tag_score: float = 0.0
    text_text_score: float = 0.0
    sparse_keyword_score: float = 0.0
    text_audio_score: float = 0.0


# ── §14  Single match result ──────────────────────────────
class MatchResult(BaseModel):
    """One matched asset with full scoring detail."""

    asset_id: str
    filename: str = ""
    primary_class: str = ""
    final_score: float = 0.0
    score_breakdown: ScoreBreakdown = Field(default_factory=ScoreBreakdown)
    match_reason: list[str] = Field(default_factory=list)


# ── §14  Full retrieval response ───────────────────────────
class RetrievalResult(BaseModel):
    """Complete output for one event — §14."""

    event_id: str
    query_summary: dict[str, Any] = Field(default_factory=dict)
    best_match: MatchResult | None = None
    alternatives: list[MatchResult] = Field(default_factory=list)


# ── §15  Retrieval log entry ──────────────────────────────
class RetrievalLogEntry(BaseModel):
    """Logged retrieval request — §15 retrieval_logs."""

    request_id: str
    event_id: str
    query_payload: dict[str, Any] = Field(default_factory=dict)
    candidate_ids: list[str] = Field(default_factory=list)
    selected_asset_id: str = ""
    scores: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
