from __future__ import annotations

from typing import Any

from db import get_conn
from embedding import embed_query
from langfuse_client import flush_langfuse
from settings import EMBEDDING_DIM, EMBEDDING_MODEL
from utils import flatten_json_tokens, normalize_token, to_vector_literal


def ensure_query_embedding(cur, video_query_event_id: int, description: str) -> None:
    cur.execute(
        """
        SELECT 1
        FROM video_query_embeddings
        WHERE video_query_event_id = %s
          AND embedding_target = 'description'
          AND embedding_model = %s
        """,
        (video_query_event_id, EMBEDDING_MODEL),
    )
    if cur.fetchone():
        return

    vector = embed_query(description)
    cur.execute(
        """
        INSERT INTO video_query_embeddings (
            video_query_event_id,
            embedding_target,
            embedding_text,
            embedding_model,
            embedding_dim,
            embedding
        )
        VALUES (%s, 'description', %s, %s, %s, %s::vector)
        """,
        (
            video_query_event_id,
            description,
            EMBEDDING_MODEL,
            EMBEDDING_DIM,
            to_vector_literal(vector),
        ),
    )


def map_track_to_source_group(track: str) -> str | None:
    if track == "foley":
        return "foley"
    if track == "sfx":
        return "sfx"
    if track == "cinematic":
        return "cinematic"
    return None


def build_event_tokens(description: str, category_path: Any, tags: Any) -> set[str]:
    tokens = set()
    tokens.update(flatten_json_tokens(description))
    tokens.update(flatten_json_tokens(category_path))
    tokens.update(flatten_json_tokens(tags))
    return tokens


def build_audio_tokens(
    primary_class: str | None,
    second_class: str | None,
    short_caption: str,
    long_caption: str,
    tags_structured: Any,
) -> set[str]:
    tokens = set()
    if primary_class:
        tokens.add(normalize_token(primary_class))
        tokens.update(flatten_json_tokens(primary_class))
    if second_class:
        tokens.add(normalize_token(second_class))
        tokens.update(flatten_json_tokens(second_class))
    tokens.update(flatten_json_tokens(short_caption))
    tokens.update(flatten_json_tokens(long_caption))
    tokens.update(flatten_json_tokens(tags_structured))
    return tokens


def score_category(category_path: Any, primary_class: str | None, second_class: str | None) -> float:
    if not isinstance(category_path, list):
        return 0.0

    normalized_primary = normalize_token(primary_class or "")
    normalized_second = normalize_token(second_class or "")
    values = {normalize_token(str(value)) for value in category_path}

    score = 0.0
    if normalized_primary and normalized_primary in values:
        score += 0.5
    if normalized_second and normalized_second in values:
        score += 0.5
    return min(score, 1.0)


def score_tags(event_tokens: set[str], audio_tokens: set[str]) -> float:
    if not event_tokens:
        return 0.0
    overlap = event_tokens & audio_tokens
    return min(len(overlap) / len(event_tokens), 1.0)


def main() -> None:
    saved_rows = 0

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, track, category_path, tags, description
                FROM video_query_events
                ORDER BY id
                """
            )
            events = cur.fetchall()

            for event_id, track, category_path, tags, description in events:
                source_group = map_track_to_source_group(track)
                if source_group is None:
                    continue

                ensure_query_embedding(cur, event_id, description)
                event_tokens = build_event_tokens(description, category_path, tags)

                cur.execute("DELETE FROM retrieval_results WHERE video_query_event_id = %s", (event_id,))
                cur.execute(
                    """
                    SELECT
                        aa.id AS audio_asset_id,
                        ae.id AS audio_embedding_id,
                        ad.primary_class,
                        ad.second_class,
                        ad.class_confidence,
                        ad.short_caption_en,
                        ad.long_caption_en,
                        ad.tags_structured,
                        1 - (ae.embedding <=> vqe.embedding) AS similarity
                    FROM audio_embeddings ae
                    JOIN audio_descriptions ad ON ad.id = ae.audio_description_id
                    JOIN audio_assets aa ON aa.id = ad.audio_asset_id
                    JOIN video_query_embeddings vqe
                      ON vqe.video_query_event_id = %s
                     AND vqe.embedding_target = 'description'
                     AND vqe.embedding_model = %s
                    WHERE aa.source_group = %s
                      AND ae.embedding_target = 'combined_caption'
                      AND ae.embedding_model = %s
                    ORDER BY ae.embedding <=> vqe.embedding
                    LIMIT 10
                    """,
                    (event_id, EMBEDDING_MODEL, source_group, EMBEDDING_MODEL),
                )
                candidates = cur.fetchall()

                ranked = []
                for candidate in candidates:
                    (
                        audio_asset_id,
                        audio_embedding_id,
                        primary_class,
                        second_class,
                        class_confidence,
                        short_caption,
                        long_caption,
                        tags_structured,
                        similarity,
                    ) = candidate
                    audio_tokens = build_audio_tokens(
                        primary_class,
                        second_class,
                        short_caption,
                        long_caption,
                        tags_structured,
                    )
                    category_score = score_category(category_path, primary_class, second_class)
                    tag_score = score_tags(event_tokens, audio_tokens)
                    confidence_score = float(class_confidence or 0.0)
                    final_score = (
                        0.75 * float(similarity)
                        + 0.10 * category_score
                        + 0.10 * tag_score
                        + 0.05 * confidence_score
                    )
                    ranked.append(
                        (
                            audio_asset_id,
                            audio_embedding_id,
                            float(similarity),
                            category_score,
                            tag_score,
                            final_score,
                        )
                    )

                ranked.sort(key=lambda item: item[-1], reverse=True)

                for rank_order, row in enumerate(ranked[:10], start=1):
                    (
                        audio_asset_id,
                        audio_embedding_id,
                        similarity,
                        category_score,
                        tag_score,
                        final_score,
                    ) = row
                    cur.execute(
                        """
                        INSERT INTO retrieval_results (
                            video_query_event_id,
                            audio_asset_id,
                            audio_embedding_id,
                            rank_order,
                            similarity,
                            track_match_score,
                            category_match_score,
                            tag_match_score,
                            final_score,
                            scoring_version
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            event_id,
                            audio_asset_id,
                            audio_embedding_id,
                            rank_order,
                            similarity,
                            1.0,
                            category_score,
                            tag_score,
                            final_score,
                            "v1_combined_caption_track_filter",
                        ),
                    )
                    saved_rows += 1

        conn.commit()

    flush_langfuse()
    print(f"saved retrieval rows: {saved_rows}")


if __name__ == "__main__":
    main()
