"""CLI entry point — main.py

Commands:
  index       — Index all audio files in a directory
  retrieve    — Retrieve sound for a single event
  batch       — Retrieve sounds for multiple events from JSON file
  evaluate    — Run evaluation benchmark
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from db import Database
from models import EventQuery, RetrievalResult


def cmd_index(args: argparse.Namespace) -> None:
    """Index all audio files in the specified directory."""
    from indexing_pipeline import index_directory

    db = Database(args.db)
    assets = index_directory(
        audio_dir=args.audio_dir,
        db=db,
        use_audio_for_caption=not args.text_only,
    )
    db.close()

    print(f"\n{'='*60}")
    print(f"Indexed {len(assets)} assets")
    for a in assets:
        print(f"  {a.asset_id}: [{a.primary_class}] {a.short_caption_en}")


def cmd_retrieve(args: argparse.Namespace) -> None:
    """Retrieve the best sound match for a single event."""
    from retrieval_pipeline import retrieve_for_event

    event_data = json.loads(args.event)
    event = EventQuery.model_validate(event_data)

    db = Database(args.db)
    result = retrieve_for_event(event, db)
    db.close()

    print(json.dumps(result.model_dump(), indent=2, ensure_ascii=False))


def cmd_batch(args: argparse.Namespace) -> None:
    """Retrieve sounds for multiple events from a JSON file."""
    from retrieval_pipeline import retrieve_batch

    events_data = json.loads(Path(args.events).read_text(encoding="utf-8"))
    if isinstance(events_data, dict):
        # May be wrapped in a list key
        events_data = events_data.get("events", [events_data])

    events = [EventQuery.model_validate(e) for e in events_data]

    db = Database(args.db)
    results = retrieve_batch(events, db)
    db.close()

    output = [r.model_dump() for r in results]

    if args.out:
        Path(args.out).write_text(
            json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print(f"Results saved to {args.out}")
    else:
        print(json.dumps(output, indent=2, ensure_ascii=False))


def cmd_evaluate(args: argparse.Namespace) -> None:
    """Run evaluation benchmark."""
    from evaluation import run_benchmark
    from retrieval_pipeline import retrieve_batch

    benchmark = json.loads(Path(args.benchmark).read_text(encoding="utf-8"))
    events_data = benchmark.get("events", [])
    ground_truth = benchmark.get("ground_truth", {})

    events = [EventQuery.model_validate(e) for e in events_data]

    db = Database(args.db)
    results = retrieve_batch(events, db, log=False)
    db.close()

    metrics = run_benchmark(results, ground_truth)

    print("\n" + "=" * 60)
    print("Evaluation Results")
    print("=" * 60)
    for k, v in metrics.items():
        if isinstance(v, float):
            print(f"  {k}: {v:.4f}")
        else:
            print(f"  {k}: {v}")

    if args.out:
        Path(args.out).write_text(
            json.dumps(metrics, indent=2), encoding="utf-8"
        )
        print(f"\nMetrics saved to {args.out}")


def cmd_list(args: argparse.Namespace) -> None:
    """List all indexed assets."""
    db = Database(args.db)
    assets = db.list_assets()
    db.close()

    if not assets:
        print("No assets indexed.")
        return

    print(f"{'ID':<25} {'Class':<12} {'Conf':>5}  Caption")
    print("-" * 80)
    for a in assets:
        print(f"{a.asset_id:<25} {a.primary_class:<12} {a.class_confidence:>5.2f}  {a.short_caption_en[:40]}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sound Sample Classification and Retrieval Pipeline"
    )
    parser.add_argument("--db", default=None, help="Database path (default: from config)")

    sub = parser.add_subparsers(dest="command", help="Available commands")

    # index
    p_index = sub.add_parser("index", help="Index audio files from a directory")
    p_index.add_argument("--audio-dir", required=True, help="Path to audio files directory")
    p_index.add_argument("--text-only", action="store_true",
                         help="Use text-based captioning only (skip audio input to Gemma 4)")

    # retrieve
    p_ret = sub.add_parser("retrieve", help="Retrieve best match for a single event")
    p_ret.add_argument("--event", required=True, help="Event JSON string")

    # batch
    p_batch = sub.add_parser("batch", help="Retrieve matches for multiple events from file")
    p_batch.add_argument("--events", required=True, help="Path to events JSON file")
    p_batch.add_argument("--out", help="Output JSON file path (default: stdout)")

    # evaluate
    p_eval = sub.add_parser("evaluate", help="Run evaluation benchmark")
    p_eval.add_argument("--benchmark", required=True, help="Path to benchmark JSON file")
    p_eval.add_argument("--out", help="Output metrics JSON file path")

    # list
    sub.add_parser("list", help="List all indexed assets")

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    dispatch = {
        "index": cmd_index,
        "retrieve": cmd_retrieve,
        "batch": cmd_batch,
        "evaluate": cmd_evaluate,
        "list": cmd_list,
    }

    dispatch[args.command](args)


if __name__ == "__main__":
    main()
