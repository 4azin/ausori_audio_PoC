from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

from db import get_conn
from settings import AUDIO_JSON_ROOT, SOUND_LIBRARY_ROOT
from utils import (
    infer_source_group,
    iter_audio_result_files,
    load_json,
    split_relative_parts,
)


def build_filename_index() -> dict[str, list[Path]]:
    index: dict[str, list[Path]] = defaultdict(list)
    for root_name in ("Foley", "Hard_SFX"):
        root = SOUND_LIBRARY_ROOT / root_name
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_file():
                index[path.name.lower()].append(path)
    return {key: sorted(values) for key, values in index.items()}


def choose_matching_path(
    filename: str,
    source_group: str,
    filename_index: dict[str, list[Path]],
) -> Path | None:
    candidates = filename_index.get(filename.lower(), [])
    if not candidates:
        return None

    preferred_root = "Foley" if source_group == "foley" else "Hard_SFX"
    preferred = [path for path in candidates if preferred_root in path.parts]
    return preferred[0] if preferred else candidates[0]


def upsert_audio_asset(cur, asset_key: str, source_group: str, local_path: Path) -> int:
    relative_path = local_path.relative_to(SOUND_LIBRARY_ROOT)
    folder_major, folder_middle, folder_sub = split_relative_parts(relative_path)
    cur.execute(
        """
        INSERT INTO audio_assets (
            asset_key,
            source_group,
            original_filename,
            local_file_path,
            relative_file_path,
            folder_major,
            folder_middle,
            folder_sub
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (asset_key)
        DO UPDATE SET
            source_group = EXCLUDED.source_group,
            original_filename = EXCLUDED.original_filename,
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
            local_path.name,
            str(local_path),
            str(relative_path),
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
    filename_index = build_filename_index()
    result_files = iter_audio_result_files(AUDIO_JSON_ROOT)
    processed_rows = 0
    missing_files: list[tuple[str, str]] = []

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

                    guessed_group = "foley" if "foley" in asset_key.lower() else "sfx"
                    local_path = choose_matching_path(filename, guessed_group, filename_index)
                    if local_path is None:
                        missing_files.append((asset_key, filename))
                        continue

                    source_group = infer_source_group(
                        asset_key,
                        local_path.relative_to(SOUND_LIBRARY_ROOT),
                    )
                    audio_asset_id = upsert_audio_asset(cur, asset_key, source_group, local_path)
                    upsert_audio_description(cur, audio_asset_id, run_name, row)
                    processed_rows += 1

        conn.commit()

    print(f"processed result files: {len(result_files)}")
    print(f"upserted description rows: {processed_rows}")
    print(f"missing local files: {len(missing_files)}")
    for asset_key, filename in missing_files[:20]:
        print(f"missing: {asset_key} -> {filename}")


if __name__ == "__main__":
    main()
