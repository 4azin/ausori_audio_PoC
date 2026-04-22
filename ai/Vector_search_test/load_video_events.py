from __future__ import annotations

import json
from collections import Counter

from db import get_conn
from settings import VIDEO_JSON_PATH
from utils import load_json


ALLOWED_TRACKS = {"foley", "sfx", "cinematic"}


def build_project_key() -> str:
    stem = VIDEO_JSON_PATH.stem
    suffix = "_LLM_text_result"
    return stem[: -len(suffix)] if stem.endswith(suffix) else stem


def main() -> None:
    payload = load_json(VIDEO_JSON_PATH)
    events = payload.get("events", [])
    project_key = build_project_key()
    input_track_counts = Counter(event.get("track") for event in events)
    saved_count = 0
    skipped_count = 0
    saved_track_counts = Counter()

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM video_query_events WHERE project_key = %s AND source_json_path = %s",
                (project_key, str(VIDEO_JSON_PATH)),
            )

            for event in events:
                track = event.get("track")
                if track not in ALLOWED_TRACKS:
                    skipped_count += 1
                    continue

                cur.execute(
                    """
                    INSERT INTO video_query_events (
                        project_key,
                        source_json_path,
                        video_context,
                        track,
                        category_path,
                        tags,
                        description,
                        start_time,
                        end_time,
                        peak_time,
                        confidence,
                        raw_event_json
                    )
                    VALUES (%s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s, %s, %s, %s::jsonb)
                    """,
                    (
                        project_key,
                        str(VIDEO_JSON_PATH),
                        payload.get("videoContext"),
                        track,
                        json.dumps(event.get("categoryPath")),
                        json.dumps(event.get("tags")),
                        event["description"],
                        event.get("startTime"),
                        event.get("endTime"),
                        event.get("peakTime"),
                        event.get("confidence"),
                        json.dumps(event),
                    ),
                )
                saved_count += 1
                saved_track_counts[track] += 1

        conn.commit()

    print(f"input video events: {len(events)}")
    print(f"saved video events: {saved_count}")
    print(f"skipped video events: {skipped_count}")
    print(f"input track counts: {dict(input_track_counts)}")
    print(f"saved track counts: {dict(saved_track_counts)}")


if __name__ == "__main__":
    main()
