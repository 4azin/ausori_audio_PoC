"""Retrieval pipeline — §9  Retrieval Pipeline.

Three stages:
  §9.1  Stage 1: Candidate generation — hybrid scoring, top-K
  §9.2  Stage 2: Reranking — text-to-audio similarity
  §9.3  Stage 3: Diversity cleanup — duplicate suppression

Output: §14 format with best_match + 2–3 alternatives + score breakdown.
"""

from __future__ import annotations

import uuid
from typing import Any

import numpy as np

from config import THRESHOLD_STRONG, THRESHOLD_USABLE, TOP_K_CANDIDATES
from db import Database
from models import (
    AudioAsset,
    EventQuery,
    MatchResult,
    NormalizedQuery,
    RetrievalLogEntry,
    RetrievalResult,
    ScoreBreakdown,
)
from query_processor import normalize_query
from scoring import compute_all_scores
from embedding_service import cosine_similarity


def _generate_match_reasons(
    breakdown: ScoreBreakdown,
    asset: AudioAsset,
    query: NormalizedQuery,
) -> list[str]:
    """Generate human-readable match reasons for the result."""
    reasons = []

    if breakdown.text_text_score >= 0.8:
        reasons.append(f"Strong semantic match (text similarity: {breakdown.text_text_score:.2f})")
    elif breakdown.text_text_score >= 0.6:
        reasons.append(f"Good semantic match (text similarity: {breakdown.text_text_score:.2f})")

    if breakdown.class_score >= 1.0:
        reasons.append(f"Exact category match: {asset.primary_class}")
    elif breakdown.class_score >= 0.6:
        reasons.append(f"Adjacent category: {asset.primary_class} (score: {breakdown.class_score:.1f})")

    if breakdown.tag_score >= 0.5:
        reasons.append(f"Strong tag overlap (score: {breakdown.tag_score:.2f})")

    if breakdown.sparse_keyword_score >= 0.5:
        reasons.append(f"Keyword match in filename/caption (score: {breakdown.sparse_keyword_score:.2f})")

    if breakdown.text_audio_score >= 0.7:
        reasons.append(f"Audio embedding confirms acoustic similarity (score: {breakdown.text_audio_score:.2f})")

    if not reasons:
        reasons.append("Weak match — review recommended")

    return reasons


def _diversity_cleanup(
    candidates: list[tuple[MatchResult, AudioAsset, np.ndarray]],
    max_alternatives: int = 3,
    dedup_threshold: float = 0.95,
) -> list[MatchResult]:
    """§9.3: Diversity cleanup.

    - Suppress near-duplicate variants (text embedding cosine > threshold).
    - Series-based diversity.
    - Return best match + 2–3 alternatives.
    """
    if not candidates:
        return []

    selected: list[MatchResult] = []
    selected_embeddings: list[np.ndarray] = []

    for match, asset, text_emb in candidates:
        # Check if this is too similar to already selected results
        is_duplicate = False
        for sel_emb in selected_embeddings:
            sim = cosine_similarity(text_emb, sel_emb)
            if sim > dedup_threshold:
                is_duplicate = True
                break

        if not is_duplicate:
            selected.append(match)
            selected_embeddings.append(text_emb)

        if len(selected) > max_alternatives + 1:  # best + alternatives
            break

    return selected


def retrieve_for_event(
    event: EventQuery,
    db: Database,
    log: bool = True,
) -> RetrievalResult:
    """Run the full retrieval pipeline for a single event.

    §9.1  Stage 1: Candidate generation
    §9.2  Stage 2: Reranking (text-to-audio)
    §9.3  Stage 3: Diversity cleanup

    Returns §14 format output.
    """
    # ── Query normalization (§8) ────────────────────────────
    normalized = normalize_query(event)

    if normalized.query_embedding_text is None:
        return RetrievalResult(
            event_id=event.event_id,
            query_summary={"event_category": event.event_category, "description": event.description},
        )

    # ── Load all assets and embeddings ──────────────────────
    assets = db.list_assets()
    text_embs = db.get_all_text_embeddings()
    audio_embs = db.get_all_audio_embeddings()
    all_aliases = db.get_all_aliases()

    if not assets:
        print(f"[retrieve] {event.event_id}: no assets in database")
        return RetrievalResult(
            event_id=event.event_id,
            query_summary={"event_category": event.event_category, "description": event.description},
        )

    # ── Stage 1: Candidate generation (§9.1) ───────────────
    scored_candidates: list[tuple[float, float, ScoreBreakdown, AudioAsset, np.ndarray]] = []

    for asset in assets:
        asset_id = asset.asset_id
        text_emb = text_embs.get(asset_id)
        audio_emb = audio_embs.get(asset_id)

        if text_emb is None:
            continue
        if audio_emb is None:
            audio_emb = text_emb  # fallback

        aliases = all_aliases.get(asset_id, [])

        breakdown, stage1, final = compute_all_scores(
            query=normalized,
            asset=asset,
            asset_text_emb=text_emb,
            asset_audio_emb=audio_emb,
            aliases=aliases,
        )

        scored_candidates.append((final, stage1, breakdown, asset, text_emb))

    # Sort by final score descending
    scored_candidates.sort(key=lambda x: x[0], reverse=True)

    # Take top-K
    top_k = scored_candidates[:TOP_K_CANDIDATES]

    # ── Stage 2: Already done — text_audio_score is in final score ──

    # ── Stage 3: Diversity cleanup (§9.3) ───────────────────
    candidate_tuples = [
        (
            MatchResult(
                asset_id=asset.asset_id,
                filename=asset.original_filename,
                primary_class=asset.primary_class,
                final_score=round(final, 4),
                score_breakdown=breakdown,
                match_reason=_generate_match_reasons(breakdown, asset, normalized),
            ),
            asset,
            text_emb,
        )
        for final, stage1, breakdown, asset, text_emb in top_k
    ]

    diverse_results = _diversity_cleanup(candidate_tuples, max_alternatives=3)

    # ── Build output (§14) ──────────────────────────────────
    best_match = diverse_results[0] if diverse_results else None
    alternatives = diverse_results[1:4] if len(diverse_results) > 1 else []

    # Add confidence assessment
    if best_match:
        if best_match.final_score >= THRESHOLD_STRONG:
            print(f"[retrieve] {event.event_id}: STRONG match → {best_match.asset_id} ({best_match.final_score:.2f})")
        elif best_match.final_score >= THRESHOLD_USABLE:
            print(f"[retrieve] {event.event_id}: usable match → {best_match.asset_id} ({best_match.final_score:.2f})")
        else:
            print(f"[retrieve] {event.event_id}: WEAK match → {best_match.asset_id} ({best_match.final_score:.2f}) — review recommended")
            best_match.match_reason.append("Low confidence — review recommended")

    result = RetrievalResult(
        event_id=event.event_id,
        query_summary={
            "event_category": event.event_category,
            "description": event.description,
        },
        best_match=best_match,
        alternatives=[
            MatchResult(
                asset_id=m.asset_id,
                filename=m.filename,
                primary_class=m.primary_class,
                final_score=m.final_score,
                score_breakdown=m.score_breakdown,
                match_reason=m.match_reason,
            )
            for m in alternatives
        ],
    )

    # ── Log retrieval (§15) ─────────────────────────────────
    if log and best_match:
        try:
            db.log_retrieval(
                RetrievalLogEntry(
                    request_id=str(uuid.uuid4()),
                    event_id=event.event_id,
                    query_payload={
                        "event_category": event.event_category,
                        "description": event.description,
                        "event_tags": event.event_tags,
                    },
                    candidate_ids=[c[3].asset_id for c in top_k[:10]],
                    selected_asset_id=best_match.asset_id,
                    scores=best_match.score_breakdown.model_dump(),
                )
            )
        except Exception as e:
            print(f"[retrieve] logging failed: {e}")

    return result


def retrieve_batch(
    events: list[EventQuery],
    db: Database,
    log: bool = True,
) -> list[RetrievalResult]:
    """Run retrieval for multiple events."""
    results = []
    for i, event in enumerate(events, 1):
        print(f"\n[retrieve] === Event {i}/{len(events)}: {event.event_id} ===")
        result = retrieve_for_event(event, db, log=log)
        results.append(result)
    return results
