from __future__ import annotations

import argparse
import hashlib
import subprocess
import traceback
from pathlib import Path
from typing import Any

import gradio as gr

from db import get_conn
from settings import SOUND_LIBRARY_ROOT

CURRENT_MATCHES: list[dict[str, Any]] = []
PREVIEW_DIR = Path(__file__).resolve().parent / ".audio_preview"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=7861)
    return parser.parse_args()


def _format_event_label(row: tuple[Any, ...]) -> str:
    event_id, track, start_time, end_time, description = row
    start = "?" if start_time is None else f"{float(start_time):.2f}s"
    end = "?" if end_time is None else f"{float(end_time):.2f}s"
    short_description = description
    if len(short_description) > 90:
        short_description = short_description[:87] + "..."
    return f"#{event_id} [{track}] {start}-{end} | {short_description}"


def list_events() -> list[str]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, track, start_time, end_time, description
                FROM video_query_events
                ORDER BY start_time NULLS LAST, id
                """
            )
            return [_format_event_label(row) for row in cur.fetchall()]


def parse_event_id(event_label: str | None) -> int | None:
    if not event_label:
        return None
    if not event_label.startswith("#"):
        return None
    return int(event_label.split(" ", 1)[0][1:])


def get_event(event_id: int) -> dict[str, Any] | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    track,
                    category_path,
                    tags,
                    description,
                    start_time,
                    end_time,
                    peak_time,
                    confidence,
                    video_context
                FROM video_query_events
                WHERE id = %s
                """,
                (event_id,),
            )
            row = cur.fetchone()
            if row is None:
                return None

    return {
        "id": row[0],
        "track": row[1],
        "category_path": row[2],
        "tags": row[3],
        "description": row[4],
        "start_time": row[5],
        "end_time": row[6],
        "peak_time": row[7],
        "confidence": row[8],
        "video_context": row[9],
    }


def get_matches(event_id: int, top_k: int) -> list[dict[str, Any]]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    rr.rank_order,
                    rr.final_score,
                    rr.similarity,
                    rr.category_match_score,
                    rr.tag_match_score,
                    aa.asset_key,
                    aa.original_filename,
                    aa.local_file_path,
                    aa.relative_file_path,
                    ad.primary_class,
                    ad.second_class,
                    ad.short_caption_en,
                    ad.long_caption_en
                FROM retrieval_results rr
                JOIN audio_assets aa ON aa.id = rr.audio_asset_id
                JOIN audio_embeddings ae ON ae.id = rr.audio_embedding_id
                JOIN audio_descriptions ad ON ad.id = ae.audio_description_id
                WHERE rr.video_query_event_id = %s
                ORDER BY rr.rank_order
                LIMIT %s
                """,
                (event_id, top_k),
            )
            rows = cur.fetchall()

    return [
        {
            "rank": row[0],
            "final_score": float(row[1]),
            "similarity": float(row[2]),
            "category_score": None if row[3] is None else float(row[3]),
            "tag_score": None if row[4] is None else float(row[4]),
            "asset_key": row[5],
            "filename": row[6],
            "local_file_path": row[7],
            "relative_file_path": row[8],
            "primary_class": row[9],
            "second_class": row[10],
            "short_caption": row[11],
            "long_caption": row[12],
        }
        for row in rows
    ]


def build_table(matches: list[dict[str, Any]]) -> list[list[Any]]:
    return [
        [
            match["rank"],
            round(match["final_score"], 4),
            round(match["similarity"], 4),
            match["category_score"],
            match["tag_score"],
            match["filename"],
            match["relative_file_path"],
            match["short_caption"],
        ]
        for match in matches
    ]


def build_preview_audio_path(source_path: Path) -> tuple[str | None, str | None]:
    if not source_path.exists():
        return None, f"Audio file does not exist: {source_path}"

    PREVIEW_DIR.mkdir(exist_ok=True)
    digest = hashlib.sha1(str(source_path).encode("utf-8")).hexdigest()[:16]
    preview_path = PREVIEW_DIR / f"{digest}.wav"

    if preview_path.exists():
        return str(preview_path), None

    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(source_path),
        "-acodec",
        "pcm_s16le",
        "-ar",
        "44100",
        "-ac",
        "2",
        str(preview_path),
    ]
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
        return str(preview_path), None
    except FileNotFoundError:
        return str(source_path), "ffmpeg not found. Serving original file; browser playback may fail."
    except subprocess.CalledProcessError as exc:
        message = exc.stderr[-1000:] if exc.stderr else str(exc)
        return str(source_path), f"ffmpeg preview conversion failed. Serving original file.\n{message}"


def build_match_detail(match: dict[str, Any]) -> tuple[str | None, str]:
    candidate_path = Path(match["local_file_path"])
    audio_path, preview_warning = build_preview_audio_path(candidate_path)

    detail = (
        f"Selected match rank: {match['rank']}\n\n"
        f"filename: {match['filename']}\n"
        f"asset_key: {match['asset_key']}\n"
        f"final_score: {match['final_score']:.4f}\n"
        f"similarity: {match['similarity']:.4f}\n"
        f"category_score: {match['category_score']}\n"
        f"tag_score: {match['tag_score']}\n"
        f"class: {match['primary_class']} / {match['second_class']}\n\n"
        f"short_caption:\n{match['short_caption']}\n\n"
        f"long_caption:\n{match['long_caption']}\n\n"
        f"path:\n{match['local_file_path']}"
    )
    if preview_warning:
        detail += f"\n\npreview warning:\n{preview_warning}"
    return audio_path, detail


def render_event(event_label: str | None, top_k: int):
    global CURRENT_MATCHES
    try:
        event_id = parse_event_id(event_label)
        if event_id is None:
            CURRENT_MATCHES = []
            return "Select an event.", [], None, ""

        event = get_event(event_id)
        if event is None:
            CURRENT_MATCHES = []
            return "Event not found.", [], None, ""

        matches = get_matches(event_id, top_k)
        CURRENT_MATCHES = matches
        top_match = matches[0] if matches else None
        audio_path = None
        detail = "No matches found. Run `python search_events.py` first."

        if top_match:
            audio_path, detail = build_match_detail(top_match)

        event_md = (
            f"### Event #{event['id']} [{event['track']}]\n\n"
            f"**Time:** {event['start_time']}s - {event['end_time']}s\n\n"
            f"**Category:** `{event['category_path']}`\n\n"
            f"**Tags:** `{event['tags']}`\n\n"
            f"**Description:**\n\n{event['description']}"
        )

        return event_md, build_table(matches), audio_path, detail
    except Exception:
        error = traceback.format_exc()
        print(error)
        return "### Error while rendering event", [], None, error


def extract_row_index(index: Any) -> int | None:
    if index is None:
        return None
    if isinstance(index, int):
        return index
    if isinstance(index, tuple):
        return int(index[0]) if index else None
    if isinstance(index, list):
        if not index:
            return None
        first = index[0]
        if isinstance(first, list | tuple):
            return int(first[0]) if first else None
        return int(first)
    return None


def select_candidate(evt: gr.SelectData):
    try:
        row_index = extract_row_index(evt.index)
        if row_index is None:
            return None, "No candidate selected."
        if row_index is None or row_index >= len(CURRENT_MATCHES):
            return None, "Selected row is out of range."

        match = CURRENT_MATCHES[row_index]
        return build_match_detail(match)
    except Exception:
        error = traceback.format_exc()
        print(error)
        return None, error


def refresh_events():
    events = list_events()
    return gr.update(choices=events, value=events[0] if events else None)


with gr.Blocks(title="Vector Search Review") as demo:
    gr.Markdown("# Vector Search Review")
    gr.Markdown("Review which audio samples were matched to each Foley/SFX video event.")

    with gr.Row():
        event_dropdown = gr.Dropdown(
            choices=list_events(),
            label="Video event",
            interactive=True,
        )
        top_k = gr.Slider(
            minimum=1,
            maximum=10,
            value=10,
            step=1,
            label="Candidates",
        )
        refresh_button = gr.Button("Refresh")

    event_markdown = gr.Markdown()
    matches_table = gr.Dataframe(
        headers=[
            "rank",
            "final_score",
            "similarity",
            "category_score",
            "tag_score",
            "filename",
            "relative_path",
            "short_caption",
        ],
        label="Matched audio candidates",
        wrap=True,
        interactive=False,
    )

    with gr.Row():
        audio_player = gr.Audio(label="Top match preview", type="filepath")
        detail_text = gr.Textbox(label="Top match detail", lines=14)

    event_dropdown.change(
        render_event,
        inputs=[event_dropdown, top_k],
        outputs=[event_markdown, matches_table, audio_player, detail_text],
    )
    top_k.change(
        render_event,
        inputs=[event_dropdown, top_k],
        outputs=[event_markdown, matches_table, audio_player, detail_text],
    )
    matches_table.select(
        select_candidate,
        outputs=[audio_player, detail_text],
    )
    refresh_button.click(refresh_events, outputs=[event_dropdown])

    demo.load(
        render_event,
        inputs=[event_dropdown, top_k],
        outputs=[event_markdown, matches_table, audio_player, detail_text],
    )


if __name__ == "__main__":
    args = parse_args()
    print(f"[review_ui] launching at http://{args.host}:{args.port}")
    demo.launch(
        server_name=args.host,
        server_port=args.port,
        show_api=False,
        allowed_paths=[str(SOUND_LIBRARY_ROOT), str(PREVIEW_DIR)],
    )
