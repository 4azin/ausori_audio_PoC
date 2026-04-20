from __future__ import annotations

import json
from pathlib import PurePosixPath

from db import get_conn
from s3_catalog import S3AudioObject, build_s3_filename_index
from settings import AUDIO_JSON_ROOT
from utils import (
    infer_source_group,
    iter_audio_result_files,
    load_json,
    split_relative_parts,
)


def choose_matching_object(
    filename: str,
    source_group: str,
    filename_index: dict[str, list[S3AudioObject]],
) -> S3AudioObject | None:
    candidates = filename_index.get(filename.lower(), [])
    if not candidates:
        return None

    preferred_markers = {
        "ambience": ("ambience",),
        "cinematic": ("cinematic",),
        "dialogue_vo": ("dialogue_vo", "dialogue"),
        "foley": ("foley",),
        "sfx": ("hard_sfx", "sfx"),
        "music": ("music",),
    }.get(source_group, ())
    preferred = [
        obj
        for obj in candidates
        if any(marker in obj.key.lower() for marker in preferred_markers)
    ]
    return preferred[0] if preferred else candidates[0]


def upsert_audio_asset(cur, asset_key: str, source_group: str, s3_object: S3AudioObject) -> int:
    relative_path = PurePosixPath(s3_object.key)
    folder_major, folder_middle, folder_sub = split_relative_parts(relative_path)
    cur.execute(
        """
        SELECT id
        FROM audio_assets
        WHERE s3_key = %s
        """,
        (s3_object.key,),
    )
    existing = cur.fetchone()
    if existing:
        cur.execute(
            """
            UPDATE audio_assets
            SET
                source_group = %s,
                original_filename = %s,
                s3_bucket = %s,
                local_file_path = NULL,
                relative_file_path = %s,
                folder_major = %s,
                folder_middle = %s,
                folder_sub = %s
            WHERE id = %s
            """,
            (
                source_group,
                s3_object.filename,
                s3_object.bucket,
                s3_object.key,
                folder_major,
                folder_middle,
                folder_sub,
                existing[0],
            ),
        )
        return existing[0]

    cur.execute(
        """
        INSERT INTO audio_assets (
            asset_key,
            source_group,
            original_filename,
            s3_bucket,
            s3_key,
            local_file_path,
            relative_file_path,
            folder_major,
            folder_middle,
            folder_sub
        )
        VALUES (%s, %s, %s, %s, %s, NULL, %s, %s, %s, %s)
        ON CONFLICT (asset_key)
        DO UPDATE SET
            source_group = EXCLUDED.source_group,
            original_filename = EXCLUDED.original_filename,
            s3_bucket = EXCLUDED.s3_bucket,
            s3_key = EXCLUDED.s3_key,
            local_file_path = EXCLUDED.local_file_path,
            relative_file_path = EXCLUDED.relative_file_path,
            folder_major = EXCLUDED.folder_major,
            folder_middle = EXCLUDED.folder_middle,
            folder_sub = EXCLUDED.folder_sub
        RETURNING id
        """,
        (
            asset_key,
            source_group,
            s3_object.filename,
            s3_object.bucket,
            s3_object.key,
            s3_object.key,
            folder_major,
            folder_middle,
            folder_sub,
        ),
    )
    return cur.fetchone()[0]


def upsert_audio_description(cur, audio_asset_id: int, run_name: str, result_row: dict) -> None:
    result = result_row["result"]
    cur.execute(
        """
        INSERT INTO audio_descriptions (
            audio_asset_id,
            llm_source,
            run_name,
            primary_class,
            second_class,
            class_confidence,
            short_caption_en,
            long_caption_en,
            tags_structured,
            raw_result_json
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb)
        ON CONFLICT (audio_asset_id, llm_source, run_name)
        DO UPDATE SET
            primary_class = EXCLUDED.primary_class,
            second_class = EXCLUDED.second_class,
            class_confidence = EXCLUDED.class_confidence,
            short_caption_en = EXCLUDED.short_caption_en,
            long_caption_en = EXCLUDED.long_caption_en,
            tags_structured = EXCLUDED.tags_structured,
            raw_result_json = EXCLUDED.raw_result_json
        """,
        (
            audio_asset_id,
            "gemini-audio-classify",
            run_name,
            result.get("primary_class"),
            result.get("second_class"),
            result.get("class_confidence"),
            result["short_caption_en"],
            result["long_caption_en"],
            json.dumps(result.get("tags_structured")),
            json.dumps(result_row),
        ),
    )


def main() -> None:
    filename_index = build_s3_filename_index()
    indexed_s3_files = sum(len(items) for items in filename_index.values())
    result_files = iter_audio_result_files(AUDIO_JSON_ROOT)
    processed_rows = 0
    missing_s3_objects: list[tuple[str, str]] = []

    with get_conn() as conn:
        with conn.cursor() as cur:
            for json_path in result_files:
                payload = load_json(json_path)
                run_name = payload.get("run_name") or json_path.parent.name
                for row in payload.get("results", []):
                    result = row.get("result") or {}
                    filename = result.get("filename")
                    asset_key = row.get("key")
                    if not filename or not asset_key:
                        continue

                    guessed_group = infer_source_group(asset_key)
                    s3_object = choose_matching_object(filename, guessed_group, filename_index)
                    if s3_object is None:
                        missing_s3_objects.append((asset_key, filename))
                        continue

                    source_group = infer_source_group(asset_key, s3_object.key)
                    audio_asset_id = upsert_audio_asset(cur, asset_key, source_group, s3_object)
                    upsert_audio_description(cur, audio_asset_id, run_name, row)
                    processed_rows += 1

        conn.commit()

    print(f"indexed s3 audio objects: {indexed_s3_files}")
    print(f"processed result files: {len(result_files)}")
    print(f"upserted description rows: {processed_rows}")
    print(f"missing s3 objects: {len(missing_s3_objects)}")
    if indexed_s3_files == 0:
        print("no S3 objects were indexed. Check AWS_S3_BUCKET, AWS_REGION, and AWS_S3_PREFIXES.")
    else:
        print("sample indexed s3 filenames:")
        for name in sorted(filename_index.keys())[:10]:
            print(f"  {name}")
    for asset_key, filename in missing_s3_objects[:20]:
        print(f"missing: {asset_key} -> {filename}")


if __name__ == "__main__":
    main()

