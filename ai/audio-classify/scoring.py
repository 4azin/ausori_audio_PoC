"""Scoring — §10  Scoring Specification + §11  Score Component Definitions.

Stage 1 score (§10):
  candidate_score_stage1 =
    0.15 * class_score +
    0.20 * tag_score +
    0.50 * text_text_score +
    0.15 * sparse_keyword_score

Final score (§10):
  final_score =
    0.65 * candidate_score_stage1 +
    0.35 * text_audio_score

These weights are initial defaults and must be tuned with evaluation data.
"""

from __future__ import annotations

import re

import numpy as np

from config import (
    CATEGORY_ADJACENCY,
    W_CLASS,
    W_SPARSE,
    W_STAGE1,
    W_TAG,
    W_TAG_REWRITTEN,
    W_TAG_UPSTREAM,
    W_TEXT_AUDIO,
    W_TEXT_TEXT,
)
from models import AudioAsset, NormalizedQuery, ScoreBreakdown, StructuredTags

from embedding_service import cosine_similarity


# ── §11.1  class_score ──────────────────────────────────────

def compute_class_score(query_class: str, asset_class: str) -> float:
    """Soft match between query category and asset primary_class.

    §11.1:
      exact match → 1.0
      adjacent category → 0.6
      weakly related → 0.2

    Do NOT hard filter here (§12).
    """
    q = query_class.lower().strip()
    a = asset_class.lower().strip()

    if q in CATEGORY_ADJACENCY:
        return CATEGORY_ADJACENCY[q].get(a, 0.1)

    # Unknown category — give a small default score
    if q == a:
        return 1.0
    return 0.1


# ── §11.2  tag_score ────────────────────────────────────────

def _flatten_tags(tags: StructuredTags) -> set[str]:
    """Flatten all structured tag values into a set of lowercase strings."""
    result = set()
    for field_name in [
        "object", "action", "material", "texture",
        "environment", "temporal", "editorial_role", "mood", "intensity",
    ]:
        val = getattr(tags, field_name, [])
        if isinstance(val, list):
            for item in val:
                result.add(item.lower().strip())
    if tags.realism:
        result.add(tags.realism.lower().strip())
    return result


def _parse_upstream_tags(tags: list[str]) -> set[str]:
    """Parse upstream tags like 'Material_Texture:Friction' into keywords."""
    result = set()
    for tag in tags:
        # Split on colon and underscore
        parts = re.split(r"[:\s_]+", tag)
        for part in parts:
            if len(part) > 1:
                result.add(part.lower())
    return result


def _jaccard_overlap(a: set[str], b: set[str]) -> float:
    """Jaccard-like overlap: |intersection| / max(|a|, 1)."""
    if not a:
        return 0.0
    intersection = a & b
    return len(intersection) / max(len(a), 1)


def compute_tag_score(
    query: NormalizedQuery,
    asset: AudioAsset,
) -> float:
    """§11.2: Combine upstream and rewritten tag overlap.

    tag_score =
      0.35 * upstream_tag_overlap +
      0.65 * rewritten_tag_overlap

    Rewritten tags should be more important than upstream tags.
    """
    asset_tags = _flatten_tags(asset.tags_structured)

    # Upstream overlap
    upstream_keywords = _parse_upstream_tags(query.query_tags_upstream)
    upstream_overlap = _jaccard_overlap(upstream_keywords, asset_tags)

    # Rewritten tag overlap
    rewritten_keywords = _flatten_tags(query.query_tags_rewritten)
    rewritten_overlap = _jaccard_overlap(rewritten_keywords, asset_tags)

    return W_TAG_UPSTREAM * upstream_overlap + W_TAG_REWRITTEN * rewritten_overlap


# ── §11.3  text_text_score ──────────────────────────────────

def compute_text_text_score(
    query_embedding: list[float] | np.ndarray,
    asset_text_embedding: list[float] | np.ndarray,
) -> float:
    """§11.3: Cosine similarity between query text embedding and candidate text embedding.

    This is the primary retrieval signal.
    """
    return cosine_similarity(query_embedding, asset_text_embedding)


# ── §11.4  sparse_keyword_score ─────────────────────────────

def _trigram_set(text: str) -> set[str]:
    """Generate character trigrams from text."""
    text = text.lower().strip()
    if len(text) < 3:
        return {text}
    return {text[i:i+3] for i in range(len(text) - 2)}


def _trigram_similarity(a: str, b: str) -> float:
    """Trigram-based similarity between two strings."""
    tg_a = _trigram_set(a)
    tg_b = _trigram_set(b)
    if not tg_a or not tg_b:
        return 0.0
    intersection = tg_a & tg_b
    union = tg_a | tg_b
    return len(intersection) / len(union) if union else 0.0


def compute_sparse_keyword_score(
    query_text: str,
    asset: AudioAsset,
    aliases: list[str] | None = None,
) -> float:
    """§11.4: Lexical matching score.

    Uses filename, aliases, manually curated keywords.
    BM25 or trigram matching.
    """
    query_lower = query_text.lower()
    query_words = set(re.split(r"\s+", query_lower))

    scores = []

    # Match against filename
    filename_norm = asset.normalized_title.lower()
    scores.append(_trigram_similarity(query_lower, filename_norm))

    # Match against short caption
    if asset.short_caption_en:
        scores.append(_trigram_similarity(query_lower, asset.short_caption_en.lower()))

    # Exact word overlap with filename words
    filename_words = set(re.split(r"\s+", filename_norm))
    if query_words and filename_words:
        word_overlap = len(query_words & filename_words) / max(len(query_words), 1)
        scores.append(word_overlap)

    # Match against aliases
    if aliases:
        alias_matches = sum(1 for a in aliases if a in query_lower)
        alias_score = alias_matches / max(len(aliases), 1)
        scores.append(alias_score)

    return max(scores) if scores else 0.0


# ── §11.5  text_audio_score ─────────────────────────────────

def compute_text_audio_score(
    query_text_embedding: list[float] | np.ndarray,
    asset_audio_embedding: list[float] | np.ndarray,
) -> float:
    """§11.5: Cosine similarity between query text embedding and candidate audio embedding.

    Use for reranking only (§2.4).
    """
    return cosine_similarity(query_text_embedding, asset_audio_embedding)


# ── Combined scoring ────────────────────────────────────────

def compute_stage1_score(breakdown: ScoreBreakdown) -> float:
    """§10: Stage 1 candidate score."""
    return (
        W_CLASS * breakdown.class_score
        + W_TAG * breakdown.tag_score
        + W_TEXT_TEXT * breakdown.text_text_score
        + W_SPARSE * breakdown.sparse_keyword_score
    )


def compute_final_score(stage1_score: float, text_audio_score: float) -> float:
    """§10: Final score combining Stage 1 with text-to-audio reranking."""
    return W_STAGE1 * stage1_score + W_TEXT_AUDIO * text_audio_score


def compute_all_scores(
    query: NormalizedQuery,
    asset: AudioAsset,
    asset_text_emb: np.ndarray,
    asset_audio_emb: np.ndarray,
    aliases: list[str] | None = None,
) -> tuple[ScoreBreakdown, float, float]:
    """Compute all score components for a query–asset pair.

    Returns:
        (score_breakdown, stage1_score, final_score)
    """
    breakdown = ScoreBreakdown(
        class_score=compute_class_score(query.query_class, asset.primary_class),
        tag_score=compute_tag_score(query, asset),
        text_text_score=compute_text_text_score(query.query_embedding_text, asset_text_emb),
        sparse_keyword_score=compute_sparse_keyword_score(
            query.query_description_raw, asset, aliases
        ),
        text_audio_score=compute_text_audio_score(query.query_embedding_text, asset_audio_emb),
    )

    stage1 = compute_stage1_score(breakdown)
    final = compute_final_score(stage1, breakdown.text_audio_score)

    return breakdown, stage1, final
