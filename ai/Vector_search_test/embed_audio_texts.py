from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from db import get_conn
from embedding import count_tokens, embed_document
from langfuse_client import flush_langfuse
from settings import EMBEDDING_DIM, EMBEDDING_MODEL, ENABLE_TOKEN_COUNT
from utils import build_combined_caption, to_vector_literal


EMBEDDING_TARGET_BUILDERS = {
    "short_caption": lambda short_caption, long_caption: short_caption,
    "long_caption": lambda short_caption, long_caption: long_caption,
    "combined_caption": build_combined_caption,
}
PROGRESS_INTERVAL = 50


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="Number of audio descriptions to embed")
    return parser.parse_args()


def write_run_summary(summary: dict) -> Path:
    runs_dir = Path(__file__).resolve().parent / "runs"
    runs_dir.mkdir(exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    file_path = runs_dir / f"embed_audio_texts_{timestamp}.json"
    file_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return file_path


def main() -> None:
    args = parse_args()
    upserted_embeddings = 0
    total_chars = 0
    total_tokens = 0
    token_count_available = False
    target_stats: dict[str, dict[str, int]] = {
        "short_caption": {"rows": 0, "chars": 0, "tokens": 0},
        "long_caption": {"rows": 0, "chars": 0, "tokens": 0},
        "combined_caption": {"rows": 0, "chars": 0, "tokens": 0},
    }
    print(f"[embed] model={EMBEDDING_MODEL}, dim={EMBEDDING_DIM}, token_count_enabled={ENABLE_TOKEN_COUNT}")
    with get_conn() as conn:
        with conn.cursor() as cur:
            if args.limit is None:
                cur.execute(
                    """
                    SELECT id, short_caption_en, long_caption_en
                    FROM audio_descriptions
                    ORDER BY id
                    """
                )
            else:
                cur.execute(
                    """
                    SELECT id, short_caption_en, long_caption_en
                    FROM audio_descriptions
                    ORDER BY id
                    LIMIT %s
                    """,
                    (args.limit,),
                )
            rows = cur.fetchall()
            total_descriptions = len(rows)
            print(f"[embed] selected descriptions={total_descriptions}")

            for index, (audio_description_id, short_caption, long_caption) in enumerate(rows, start=1):
                for target, builder in EMBEDDING_TARGET_BUILDERS.items():
                    embedding_text = builder(short_caption, long_caption)
                    token_count = count_tokens(embedding_text)
                    vector = embed_document(embedding_text)
                    total_chars += len(embedding_text)
                    target_stats[target]["rows"] += 1
                    target_stats[target]["chars"] += len(embedding_text)
                    if token_count is not None:
                        token_count_available = True
                        total_tokens += token_count
                        target_stats[target]["tokens"] += token_count
                    cur.execute(
                        """
                        INSERT INTO audio_embeddings (
                            audio_description_id,
                            embedding_target,
                            embedding_text,
                            embedding_model,
                            embedding_dim,
                            embedding
                        )
                        VALUES (%s, %s, %s, %s, %s, %s::vector)
                        ON CONFLICT (audio_description_id, embedding_target, embedding_model)
                        DO UPDATE SET
                            embedding_text = EXCLUDED.embedding_text,
                            embedding_dim = EXCLUDED.embedding_dim,
                            embedding = EXCLUDED.embedding
                        """,
                        (
                            audio_description_id,
                            target,
                            embedding_text,
                            EMBEDDING_MODEL,
                            EMBEDDING_DIM,
                            to_vector_literal(vector),
                        ),
                    )
                    upserted_embeddings += 1

                if index % PROGRESS_INTERVAL == 0 or index == total_descriptions:
                    token_text = total_tokens if token_count_available else "unavailable"
                    print(
                        f"[embed] progress descriptions={index}/{total_descriptions}, "
                        f"embeddings={upserted_embeddings}, total_tokens={token_text}"
                    )

        conn.commit()

    flush_langfuse()
    summary = {
        "run_type": "embed_audio_texts",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "selected_audio_descriptions": len(rows),
        "upserted_audio_embeddings": upserted_embeddings,
        "embedding_model": EMBEDDING_MODEL,
        "embedding_dim": EMBEDDING_DIM,
        "total_input_chars": total_chars,
        "total_input_tokens": total_tokens if token_count_available else None,
        "by_target": target_stats,
    }
    summary_path = write_run_summary(summary)
    print(f"selected audio descriptions: {len(rows)}")
    print(f"upserted audio embeddings: {upserted_embeddings}")
    print(f"total input chars: {total_chars}")
    if token_count_available:
        print(f"total input tokens: {total_tokens}")
    else:
        print("total input tokens: unavailable")
    for target, stats in target_stats.items():
        token_text = str(stats["tokens"]) if token_count_available else "unavailable"
        print(
            f"{target}: rows={stats['rows']}, chars={stats['chars']}, tokens={token_text}"
        )
    print(f"run summary saved: {summary_path}")


if __name__ == "__main__":
    main()
