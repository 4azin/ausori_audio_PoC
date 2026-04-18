"""Evaluation metrics — §17  Evaluation Metrics.

Retrieval metrics:
  • Recall@1, Recall@3, Recall@5
  • MRR (Mean Reciprocal Rank)
  • NDCG (Normalized Discounted Cumulative Gain)

Classification metrics:
  • top-1 accuracy
  • macro F1
  • confusion matrix

Diagnostic checks:
  • how often the correct result is lost because of tag mismatch
  • how often category mismatch still yields a good result
  • how often audio reranking improves ranking
  • failure rate on long or mixed-source clips
"""

from __future__ import annotations

import json
import math
from collections import Counter
from pathlib import Path
from typing import Any

from models import RetrievalResult


# ── Retrieval metrics ───────────────────────────────────────

def recall_at_k(
    predictions: list[list[str]],
    ground_truth: list[str],
    k: int,
) -> float:
    """Recall@K: fraction of queries where the correct result is in top-K.

    Args:
        predictions: List of ranked prediction lists per query.
        ground_truth: List of correct asset IDs (one per query).
        k: Cutoff rank.
    """
    if not predictions:
        return 0.0

    hits = 0
    for preds, gt in zip(predictions, ground_truth):
        if gt in preds[:k]:
            hits += 1

    return hits / len(predictions)


def mrr(
    predictions: list[list[str]],
    ground_truth: list[str],
) -> float:
    """Mean Reciprocal Rank.

    For each query, the reciprocal rank is 1/rank of the first correct result.
    """
    if not predictions:
        return 0.0

    total_rr = 0.0
    for preds, gt in zip(predictions, ground_truth):
        for rank, pred in enumerate(preds, 1):
            if pred == gt:
                total_rr += 1.0 / rank
                break

    return total_rr / len(predictions)


def dcg_at_k(relevance: list[float], k: int) -> float:
    """Discounted Cumulative Gain at K."""
    dcg = 0.0
    for i, rel in enumerate(relevance[:k]):
        dcg += rel / math.log2(i + 2)  # i+2 because log2(1)=0
    return dcg


def ndcg_at_k(
    predictions: list[list[str]],
    ground_truth: list[str],
    k: int,
) -> float:
    """Normalized Discounted Cumulative Gain at K.

    Binary relevance: 1 if correct, 0 if not.
    """
    if not predictions:
        return 0.0

    total_ndcg = 0.0
    for preds, gt in zip(predictions, ground_truth):
        relevance = [1.0 if p == gt else 0.0 for p in preds[:k]]
        ideal_relevance = sorted(relevance, reverse=True)

        actual_dcg = dcg_at_k(relevance, k)
        ideal_dcg = dcg_at_k(ideal_relevance, k)

        if ideal_dcg > 0:
            total_ndcg += actual_dcg / ideal_dcg
        elif 1.0 not in relevance:
            # GT not in top-K at all, but ideal_dcg would be >0 if we included it
            total_ndcg += 0.0

    return total_ndcg / len(predictions)


# ── Classification metrics ──────────────────────────────────

def top1_accuracy(
    predictions: list[str],
    ground_truth: list[str],
) -> float:
    """Top-1 classification accuracy."""
    if not predictions:
        return 0.0
    correct = sum(1 for p, g in zip(predictions, ground_truth) if p == g)
    return correct / len(predictions)


def macro_f1(
    predictions: list[str],
    ground_truth: list[str],
) -> float:
    """Macro-averaged F1 score across all classes."""
    classes = set(ground_truth) | set(predictions)
    f1_scores = []

    for cls in classes:
        tp = sum(1 for p, g in zip(predictions, ground_truth) if p == cls and g == cls)
        fp = sum(1 for p, g in zip(predictions, ground_truth) if p == cls and g != cls)
        fn = sum(1 for p, g in zip(predictions, ground_truth) if p != cls and g == cls)

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
        f1_scores.append(f1)

    return sum(f1_scores) / len(f1_scores) if f1_scores else 0.0


def confusion_matrix(
    predictions: list[str],
    ground_truth: list[str],
) -> dict[str, dict[str, int]]:
    """Build a confusion matrix as a nested dict."""
    classes = sorted(set(ground_truth) | set(predictions))
    matrix: dict[str, dict[str, int]] = {c: {cc: 0 for cc in classes} for c in classes}

    for pred, gt in zip(predictions, ground_truth):
        matrix[gt][pred] += 1

    return matrix


# ── Diagnostic checks ──────────────────────────────────────

def compute_diagnostics(results: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute diagnostic checks per §17.

    Each result dict should have:
      - event_id
      - ground_truth_asset_id
      - predicted_asset_ids: list[str] (ranked)
      - tag_mismatch: bool (upstream tags didn't match correct asset)
      - category_mismatch: bool (query and correct asset have different categories)
      - audio_rerank_improved: bool (audio reranking improved the rank)
      - asset_duration_ms: int (duration of the correct asset)
    """
    if not results:
        return {}

    n = len(results)

    tag_mismatch_count = sum(1 for r in results if r.get("tag_mismatch", False))
    tag_mismatch_loss = sum(
        1 for r in results
        if r.get("tag_mismatch", False)
        and r.get("ground_truth_asset_id") not in r.get("predicted_asset_ids", [])[:5]
    )

    category_mismatch_success = sum(
        1 for r in results
        if r.get("category_mismatch", False)
        and r.get("ground_truth_asset_id") in r.get("predicted_asset_ids", [])[:3]
    )
    category_mismatch_total = sum(1 for r in results if r.get("category_mismatch", False))

    audio_rerank_improved = sum(1 for r in results if r.get("audio_rerank_improved", False))

    long_clip_failures = sum(
        1 for r in results
        if r.get("asset_duration_ms", 0) > 30_000
        and r.get("ground_truth_asset_id") not in r.get("predicted_asset_ids", [])[:3]
    )
    long_clip_total = sum(1 for r in results if r.get("asset_duration_ms", 0) > 30_000)

    return {
        "total_queries": n,
        "tag_mismatch_rate": tag_mismatch_count / n,
        "tag_mismatch_loss_rate": tag_mismatch_loss / max(tag_mismatch_count, 1),
        "category_mismatch_success_rate": (
            category_mismatch_success / max(category_mismatch_total, 1)
        ),
        "audio_rerank_improvement_rate": audio_rerank_improved / n,
        "long_clip_failure_rate": long_clip_failures / max(long_clip_total, 1),
    }


# ── Benchmark runner ────────────────────────────────────────

def run_benchmark(
    results: list[RetrievalResult],
    ground_truth: dict[str, str],
) -> dict[str, float]:
    """Run the full benchmark evaluation.

    Args:
        results: List of RetrievalResult from the retrieval pipeline.
        ground_truth: Dict mapping event_id → correct asset_id.

    Returns:
        Dict with all metric values.
    """
    predictions = []
    gt_list = []

    for result in results:
        if result.event_id not in ground_truth:
            continue

        # Build ranked prediction list
        ranked = []
        if result.best_match:
            ranked.append(result.best_match.asset_id)
        for alt in result.alternatives:
            ranked.append(alt.asset_id)

        predictions.append(ranked)
        gt_list.append(ground_truth[result.event_id])

    if not predictions:
        return {"error": "no matching results"}

    return {
        "recall_at_1": recall_at_k(predictions, gt_list, 1),
        "recall_at_3": recall_at_k(predictions, gt_list, 3),
        "recall_at_5": recall_at_k(predictions, gt_list, 5),
        "mrr": mrr(predictions, gt_list),
        "ndcg_at_5": ndcg_at_k(predictions, gt_list, 5),
        "total_queries": len(predictions),
    }
