from __future__ import annotations

import argparse
import csv
import json
import random
import re
import time
from pathlib import Path
from typing import Any

from config import (
    AMBIENCE_ROOT,
    CINEMATIC_ROOT,
    DIALOGUE_VO_ROOT,
    FOLEY_ROOT,
    GEMINI_API_KEY,
    GEMINI_MODEL,
    HARD_SFX_ROOT,
    MUSIC_ROOT,
    SUPPORTED_EXTENSIONS,
    ensure_runs_dir,
)
from llmops import flush_langfuse, run_span, start_generation


def get_client():
    if not GEMINI_API_KEY:
        raise EnvironmentError("GEMINI_API_KEY is not set. Check .env.")
    from google import genai

    return genai.Client(api_key=GEMINI_API_KEY)


def get_group_root(group: str) -> Path:
    group_name = group.lower()
    if group_name == "foley":
        return FOLEY_ROOT
    if group_name == "hard_sfx":
        return HARD_SFX_ROOT
    if group_name == "cinematic":
        return CINEMATIC_ROOT
    if group_name == "ambience":
        return AMBIENCE_ROOT
    if group_name == "music":
        return MUSIC_ROOT
    if group_name == "dialogue_vo":
        return DIALOGUE_VO_ROOT
    raise ValueError(f"Unsupported group: {group}")


def get_run_dir(run_name: str) -> Path:
    run_dir = ensure_runs_dir() / run_name
    run_dir.mkdir(parents=True, exist_ok=True)
    return run_dir


def scan_audio_files(root: Path) -> list[Path]:
    if not root.exists():
        raise FileNotFoundError(f"Audio root does not exist: {root}")
    return sorted(
        path for path in root.rglob("*") if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def manifest_paths(run_dir: Path) -> tuple[Path, Path]:
    return run_dir / "manifest.json", run_dir / "manifest.csv"


def write_manifest(run_dir: Path, manifest: dict[str, Any]) -> tuple[Path, Path]:
    manifest_json, manifest_csv = manifest_paths(run_dir)
    write_json(manifest_json, manifest)

    fieldnames = ["request_key", "filename", "relative_path", "absolute_path", "mime_type", "size_bytes"]
    if any("root_label" in item for item in manifest["files"]):
        fieldnames.insert(1, "root_label")

    with manifest_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=fieldnames,
        )
        writer.writeheader()
        writer.writerows(manifest["files"])

    return manifest_json, manifest_csv


def build_manifest_for_paths(
    *,
    run_name: str,
    group: str,
    seed: int,
    root_label_to_path: list[tuple[str, Path]],
    selected: list[Path],
) -> dict[str, Any]:
    root_map = {label: str(path) for label, path in root_label_to_path}
    path_to_label = {str(path): label for label, path in root_label_to_path}

    manifest = {
        "run_name": run_name,
        "group": group,
        "count": len(selected),
        "seed": seed,
        "roots": root_map,
        "model": GEMINI_MODEL,
        "files": [],
    }

    for index, path in enumerate(selected, start=1):
        matched_label = None
        matched_root = None
        for label, root_path in root_label_to_path:
            try:
                rel = path.relative_to(root_path)
                matched_label = label
                matched_root = root_path
                break
            except ValueError:
                continue
        if matched_label is None or matched_root is None:
            raise ValueError(f"Could not match file to configured roots: {path}")

        manifest["files"].append(
            {
                "request_key": f"{group.lower()}-{index:05d}",
                "root_label": matched_label,
                "filename": path.name,
                "relative_path": str(path.relative_to(matched_root)),
                "absolute_path": str(path),
                "mime_type": "audio/wav",
                "size_bytes": path.stat().st_size,
            }
        )

    return manifest


def cmd_sample(args: argparse.Namespace) -> None:
    run_dir = get_run_dir(args.run_name)
    root = get_group_root(args.group)
    with run_span(
        run_dir=run_dir,
        run_name=args.run_name,
        span_name="sample-files",
        input_payload={"group": args.group, "count": args.count, "seed": args.seed},
        metadata={"root": str(root)},
    ) as span:
        files = scan_audio_files(root)

        if len(files) < args.count:
            raise ValueError(f"Requested {args.count} files, but found only {len(files)} in {root}")

        rng = random.Random(args.seed)
        selected = sorted(rng.sample(files, args.count))

        manifest = build_manifest_for_paths(
            run_name=args.run_name,
            group=args.group.lower(),
            seed=args.seed,
            root_label_to_path=[(args.group.lower(), root)],
            selected=selected,
        )

        manifest_json, manifest_csv = write_manifest(run_dir, manifest)

        if span is not None:
            span.update(output={"manifest_path": str(manifest_json), "sampled_count": len(manifest["files"])})

    print(f"Sampled {args.count} files from {root}")
    print(f"Saved manifest: {manifest_json}")


def cmd_prepare_run(args: argparse.Namespace) -> None:
    run_dir = get_run_dir(args.run_name)

    root_label_to_path: list[tuple[str, Path]]
    if args.group == "all":
        root_label_to_path = [("foley", FOLEY_ROOT), ("hard_sfx", HARD_SFX_ROOT)]
        optional_groups = [
            ("cinematic", CINEMATIC_ROOT),
            ("ambience", AMBIENCE_ROOT),
            ("music", MUSIC_ROOT),
            ("dialogue_vo", DIALOGUE_VO_ROOT),
        ]
        for label, path in optional_groups:
            if str(path) and str(path) != "." and path.exists():
                root_label_to_path.append((label, path))
    else:
        root = get_group_root(args.group)
        root_label_to_path = [(args.group.lower(), root)]

    with run_span(
        run_dir=run_dir,
        run_name=args.run_name,
        span_name="prepare-run",
        input_payload={"group": args.group, "limit": args.limit},
        metadata={"roots": {label: str(path) for label, path in root_label_to_path}},
    ) as span:
        files: list[Path] = []
        for _, root in root_label_to_path:
            files.extend(scan_audio_files(root))
        files = sorted(files)
        if args.limit is not None:
            files = files[: args.limit]

        manifest = build_manifest_for_paths(
            run_name=args.run_name,
            group=args.group.lower(),
            seed=0,
            root_label_to_path=root_label_to_path,
            selected=files,
        )
        manifest_json, _ = write_manifest(run_dir, manifest)
        if span is not None:
            span.update(output={"manifest_path": str(manifest_json), "prepared_count": len(files)})

    print(f"Prepared run with {len(files)} files")
    print(f"Saved manifest: {manifest_json}")


def cmd_split_run(args: argparse.Namespace) -> None:
    run_dir = get_run_dir(args.run_name)
    manifest = load_manifest(run_dir)
    files = manifest["files"]
    chunk_size = args.chunk_size
    total_chunks = (len(files) + chunk_size - 1) // chunk_size if files else 0
    child_runs: list[str] = []

    with run_span(
        run_dir=run_dir,
        run_name=args.run_name,
        span_name="split-run",
        input_payload={"chunk_size": chunk_size, "file_count": len(files)},
    ) as span:
        for index in range(total_chunks):
            chunk_files = files[index * chunk_size : (index + 1) * chunk_size]
            child_run_name = f"{args.run_name}_chunk_{index + 1:04d}"
            child_runs.append(child_run_name)
            child_run_dir = get_run_dir(child_run_name)
            child_manifest = {
                **manifest,
                "run_name": child_run_name,
                "parent_run_name": args.run_name,
                "chunk_index": index + 1,
                "chunk_size": chunk_size,
                "chunk_total": total_chunks,
                "count": len(chunk_files),
                "files": chunk_files,
            }
            write_manifest(child_run_dir, child_manifest)

        split_payload = {
            "parent_run_name": args.run_name,
            "chunk_size": chunk_size,
            "chunk_total": total_chunks,
            "child_runs": child_runs,
        }
        write_json(run_dir / "split_runs.json", split_payload)
        if span is not None:
            span.update(output=split_payload)

    print(f"Split {len(files)} files into {total_chunks} chunks")
    print(f"Saved split manifest: {run_dir / 'split_runs.json'}")


def cmd_upload(args: argparse.Namespace) -> None:
    run_dir = get_run_dir(args.run_name)
    manifest = read_json(run_dir / "manifest.json")
    client = get_client()

    uploads_path = run_dir / "uploads.json"
    existing_uploads: dict[str, dict[str, Any]] = {}
    if uploads_path.exists():
        existing_payload = read_json(uploads_path)
        existing_uploads = {item["request_key"]: item for item in existing_payload.get("uploads", [])}

    uploads: list[dict[str, Any]] = list(existing_uploads.values())
    with run_span(
        run_dir=run_dir,
        run_name=args.run_name,
        span_name="upload-source-files",
        input_payload={"file_count": len(manifest["files"])},
        metadata={"group": manifest.get("group"), "model": manifest.get("model")},
    ) as span:
        for item in manifest["files"]:
            if item["request_key"] in existing_uploads:
                print(f"Skipping upload for {item['request_key']} (already uploaded)")
                continue
            path = Path(item["absolute_path"])
            with start_generation(
                run_dir=run_dir,
                run_name=args.run_name,
                name="upload-file",
                model="gemini-files-api",
                input_payload={"filename": item["filename"], "request_key": item["request_key"]},
                metadata={"absolute_path": item["absolute_path"], "mime_type": item["mime_type"]},
            ) as generation:
                uploaded = client.files.upload(file=str(path))
                upload_payload = {
                    "request_key": item["request_key"],
                    "filename": item["filename"],
                    "absolute_path": item["absolute_path"],
                    "mime_type": getattr(uploaded, "mime_type", item["mime_type"]),
                    "file_name": uploaded.name,
                    "file_uri": getattr(uploaded, "uri", ""),
                }
                uploads.append(upload_payload)
                existing_uploads[item["request_key"]] = upload_payload
                if generation is not None:
                    generation.update(output=upload_payload)
            print(f"Uploaded {item['request_key']} -> {uploaded.name}")

        uploads = sorted(uploads, key=lambda x: x["request_key"])
        write_json(uploads_path, {"run_name": args.run_name, "uploads": uploads})
        if span is not None:
            span.update(output={"uploaded_count": len(uploads), "uploads_path": str(uploads_path)})
    print(f"Saved uploads: {uploads_path}")


def build_prompt_with_filename_hint(filename: str) -> str:
    from schema import PROMPT

    stem = Path(filename).stem
    normalized_hint = re.sub(r"[_\-]+", " ", stem)
    normalized_hint = re.sub(r"\s+", " ", normalized_hint).strip()

    filename_hint = (
        f"[Filename hint]\n"
        f"original_filename: {filename}\n"
        f"normalized_filename_hint: {normalized_hint}\n"
        f"Use this only as a weak hint. Prefer the audio whenever the filename is unclear or misleading.\n\n"
    )
    return filename_hint + PROMPT


def build_batch_request_row(upload: dict[str, Any]) -> dict[str, Any]:
    from schema import RESPONSE_JSON_SCHEMA

    return {
        "key": upload["request_key"],
        "request": {
            "contents": [
                {
                    "parts": [
                        {"text": build_prompt_with_filename_hint(upload["filename"])},
                        {
                            "file_data": {
                                "mime_type": upload["mime_type"],
                                "file_uri": upload["file_uri"],
                            }
                        },
                    ]
                }
            ],
            "generation_config": {
                "response_mime_type": "application/json",
                "response_json_schema": RESPONSE_JSON_SCHEMA,
                "temperature": 0,
            },
        },
    }


def cmd_build_batch(args: argparse.Namespace) -> None:
    run_dir = get_run_dir(args.run_name)
    uploads_payload = read_json(run_dir / "uploads.json")
    with run_span(
        run_dir=run_dir,
        run_name=args.run_name,
        span_name="build-batch-jsonl",
        input_payload={"upload_count": len(uploads_payload["uploads"])},
    ) as span:
        rows = [build_batch_request_row(upload) for upload in uploads_payload["uploads"]]
        batch_path = run_dir / "batch_requests.jsonl"
        write_jsonl(batch_path, rows)
        if span is not None:
            span.update(output={"request_count": len(rows), "batch_path": str(batch_path)})
    print(f"Saved batch request file: {batch_path}")


def load_manifest(run_dir: Path) -> dict[str, Any]:
    return read_json(run_dir / "manifest.json")


def get_manifest_item(run_dir: Path, request_key: str) -> dict[str, Any]:
    manifest = load_manifest(run_dir)
    for item in manifest["files"]:
        if item["request_key"] == request_key:
            return item
    raise KeyError(f"request_key not found in manifest: {request_key}")


def cmd_sync_analyze(args: argparse.Namespace) -> None:
    from google.genai import types
    from schema import RESPONSE_JSON_SCHEMA

    run_dir = get_run_dir(args.run_name)
    item = get_manifest_item(run_dir, args.key)
    client = get_client()
    audio_bytes = Path(item["absolute_path"]).read_bytes()

    with start_generation(
        run_dir=run_dir,
        run_name=args.run_name,
        name="sync-analyze",
        model=GEMINI_MODEL,
        input_payload={"request_key": args.key, "filename": item["filename"]},
        metadata={"mode": "sync", "absolute_path": item["absolute_path"]},
    ) as generation:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                build_prompt_with_filename_hint(item["filename"]),
                types.Part.from_bytes(data=audio_bytes, mime_type=item["mime_type"]),
            ],
            config={
                "response_mime_type": "application/json",
                "response_json_schema": RESPONSE_JSON_SCHEMA,
                "temperature": 0,
            },
        )

        raw_text = (getattr(response, "text", "") or "").strip()
        if raw_text.startswith("```"):
            parts = raw_text.split("```")
            if len(parts) > 1:
                raw_text = parts[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()

        parsed = json.loads(raw_text)
        parsed["filename"] = item["filename"]

        usage = None
        usage_meta = getattr(response, "usage_metadata", None)
        if usage_meta is not None:
            usage = {}
            prompt_tokens = getattr(usage_meta, "prompt_token_count", None)
            completion_tokens = getattr(usage_meta, "candidates_token_count", None)
            total_tokens = getattr(usage_meta, "total_token_count", None)
            if prompt_tokens is not None:
                usage["prompt_tokens"] = prompt_tokens
            if completion_tokens is not None:
                usage["completion_tokens"] = completion_tokens
            if total_tokens is not None:
                usage["total_tokens"] = total_tokens

        if generation is not None:
            generation.update(output=parsed, usage_details=usage)

    print(json.dumps(parsed, ensure_ascii=False, indent=2))
    return {
        "key": args.key,
        "result": parsed,
        "usage_details": usage,
    }


def cmd_sync_run(args: argparse.Namespace) -> None:
    run_dir = get_run_dir(args.run_name)
    aggregated_results_path = run_dir / "sync_results.json"
    aggregated_errors_path = run_dir / "sync_errors.json"
    if aggregated_results_path.exists() and aggregated_errors_path.exists():
        print(f"Sync results already exist: {aggregated_results_path}")
        return

    manifest = load_manifest(run_dir)
    items = manifest["files"]

    if args.limit is not None:
        items = items[: args.limit]

    with run_span(
        run_dir=run_dir,
        run_name=args.run_name,
        span_name="sync-run",
        input_payload={"run_name": args.run_name, "count": len(items)},
        metadata={"mode": "sync-multi"},
    ) as span:
        completed = 0
        failed = 0
        results: list[dict[str, Any]] = []
        errors: list[dict[str, Any]] = []

        for item in items:
            print(f"[sync] {item['request_key']} {item['filename']}")
            try:
                sync_result = cmd_sync_analyze(
                    argparse.Namespace(
                        run_name=args.run_name,
                        key=item["request_key"],
                    )
                )
                if sync_result is not None:
                    results.append(
                        {
                            "key": sync_result["key"],
                            "result": sync_result["result"],
                            "usage_details": sync_result.get("usage_details"),
                        }
                    )
                completed += 1
            except Exception as exc:
                failed += 1
                errors.append(
                    {
                        "key": item["request_key"],
                        "filename": item["filename"],
                        "error": str(exc),
                    }
                )
                print(f"[sync] FAILED {item['request_key']}: {exc}")

        write_json(aggregated_results_path, {"run_name": args.run_name, "results": results})
        write_json(aggregated_errors_path, {"run_name": args.run_name, "errors": errors})

        if span is not None:
            span.update(
                output={
                    "completed": completed,
                    "failed": failed,
                    "total": len(items),
                    "sync_results_path": str(aggregated_results_path),
                    "sync_errors_path": str(aggregated_errors_path),
                }
            )

    print(f"Sync run complete: completed={completed}, failed={failed}, total={len(items)}")
    print(f"Saved aggregated sync results: {aggregated_results_path}")
    print(f"Saved aggregated sync errors: {aggregated_errors_path}")


def cmd_merge_sync_results(args: argparse.Namespace) -> None:
    run_dir = get_run_dir(args.run_name)
    result_files = sorted(run_dir.glob("sync_result_*.json"))
    aggregated_results_path = run_dir / "sync_results.json"
    aggregated_errors_path = run_dir / "sync_errors.json"

    results: list[dict[str, Any]] = []
    seen_keys: set[str] = set()

    if aggregated_results_path.exists():
        existing = read_json(aggregated_results_path)
        for item in existing.get("results", []):
            key = item.get("key")
            if key:
                seen_keys.add(key)
            results.append(item)

    manifest = load_manifest(run_dir)
    key_to_filename = {item["request_key"]: item["filename"] for item in manifest["files"]}

    for path in result_files:
        key = path.stem.replace("sync_result_", "", 1)
        if key in seen_keys:
            continue
        payload = read_json(path)
        payload["filename"] = key_to_filename.get(key, payload.get("filename", ""))
        results.append({"key": key, "result": payload, "usage_details": None})
        seen_keys.add(key)

    write_json(aggregated_results_path, {"run_name": args.run_name, "results": results})
    if not aggregated_errors_path.exists():
        write_json(aggregated_errors_path, {"run_name": args.run_name, "errors": []})

    deleted = 0
    if args.delete_individual:
        for path in result_files:
            path.unlink()
            deleted += 1

    print(f"Merged {len(result_files)} individual sync result files")
    print(f"Saved aggregated sync results: {aggregated_results_path}")
    if args.delete_individual:
        print(f"Deleted individual sync result files: {deleted}")


def cmd_process_run_sync(args: argparse.Namespace) -> None:
    run_dir = get_run_dir(args.run_name)
    with run_span(
        run_dir=run_dir,
        run_name=args.run_name,
        span_name="process-run-sync",
        input_payload={"run_name": args.run_name, "limit": args.limit},
        metadata={"mode": "sync-resume-safe"},
    ) as span:
        cmd_sync_run(
            argparse.Namespace(
                run_name=args.run_name,
                limit=args.limit,
            )
        )
        if span is not None:
            span.update(output={"completed": True})


def cmd_process_split_sync(args: argparse.Namespace) -> None:
    run_dir = get_run_dir(args.run_name)
    split_payload = read_json(run_dir / "split_runs.json")
    child_runs = split_payload["child_runs"]
    if args.limit is not None:
        child_runs = child_runs[: args.limit]

    with run_span(
        run_dir=run_dir,
        run_name=args.run_name,
        span_name="process-split-sync",
        input_payload={
            "run_name": args.run_name,
            "chunk_count": len(child_runs),
        },
        metadata={"mode": "sync-resume-safe-split"},
    ) as span:
        completed = 0
        failed = 0
        for child_run_name in child_runs:
            print(f"[sync-chunk] Processing {child_run_name}")
            try:
                cmd_process_run_sync(
                    argparse.Namespace(
                        run_name=child_run_name,
                        limit=None,
                    )
                )
                completed += 1
            except Exception as exc:
                failed += 1
                print(f"[sync-chunk] FAILED {child_run_name}: {exc}")
                if not args.continue_on_error:
                    raise

        if span is not None:
            span.update(output={"completed": completed, "failed": failed, "total": len(child_runs)})

    print(f"Sync split processing complete: completed={completed}, failed={failed}, total={len(child_runs)}")


def cmd_create_batch(args: argparse.Namespace) -> None:
    run_dir = get_run_dir(args.run_name)
    batch_job_path = run_dir / "batch_job.json"
    if batch_job_path.exists():
        payload = read_json(batch_job_path)
        if payload.get("batch_job_name"):
            print(f"Reusing existing batch job: {payload['batch_job_name']}")
            return

    client = get_client()
    from google.genai import types

    with run_span(
        run_dir=run_dir,
        run_name=args.run_name,
        span_name="create-batch-job",
        input_payload={"batch_request_file": str(run_dir / "batch_requests.jsonl"), "model": GEMINI_MODEL},
    ) as span:
        batch_input_file = client.files.upload(
            file=str(run_dir / "batch_requests.jsonl"),
            config=types.UploadFileConfig(
                display_name=f"{args.run_name}-batch-requests",
                mime_type="jsonl",
            ),
        )
        batch_job = client.batches.create(
            model=GEMINI_MODEL,
            src=batch_input_file.name,
            config={"display_name": args.run_name},
        )
        payload = {
            "run_name": args.run_name,
            "model": GEMINI_MODEL,
            "input_file_name": batch_input_file.name,
            "batch_job_name": batch_job.name,
            "state": getattr(batch_job, "state", None),
        }
        write_json(run_dir / "batch_job.json", payload)
        if span is not None:
            span.update(output=payload)
    print(f"Created batch job: {batch_job.name}")


def cmd_batch_status(args: argparse.Namespace) -> None:
    run_dir = get_run_dir(args.run_name)
    updated = get_batch_status(run_dir=run_dir, run_name=args.run_name, traced=True)
    print(json.dumps(updated, ensure_ascii=False, indent=2))


def get_batch_status(*, run_dir: Path, run_name: str, traced: bool) -> dict[str, Any]:
    job_payload = read_json(run_dir / "batch_job.json")
    client = get_client()

    def _serialize(value: Any) -> Any:
        if value is None or isinstance(value, (str, int, float, bool)):
            return value
        if isinstance(value, dict):
            return {k: _serialize(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [_serialize(v) for v in value]
        if hasattr(value, "model_dump"):
            return _serialize(value.model_dump())
        if hasattr(value, "__dict__"):
            return {
                k: _serialize(v)
                for k, v in vars(value).items()
                if not k.startswith("_")
            }
        return str(value)

    def _fetch() -> dict[str, Any]:
        job = client.batches.get(name=job_payload["batch_job_name"])
        state = getattr(job, "state", None)
        destination = getattr(job, "dest", None)
        output_file_name = getattr(destination, "file_name", None) if destination else None
        error = getattr(job, "error", None)
        updated = {
            **job_payload,
            "state": state,
            "output_file_name": output_file_name,
            "error": _serialize(error),
        }
        write_json(run_dir / "batch_job.json", updated)
        return updated

    if not traced:
        return _fetch()

    with run_span(
        run_dir=run_dir,
        run_name=run_name,
        span_name="batch-status",
        input_payload={"batch_job_name": job_payload["batch_job_name"]},
    ) as span:
        updated = _fetch()
        if span is not None:
            span.update(output=updated)
        return updated


def cmd_fetch_output(args: argparse.Namespace) -> None:
    run_dir = get_run_dir(args.run_name)
    output_path = run_dir / "batch_output.jsonl"
    if output_path.exists():
        print(f"Batch output already exists: {output_path}")
        return

    job_payload = read_json(run_dir / "batch_job.json")
    output_file_name = job_payload.get("output_file_name")
    if not output_file_name:
        raise ValueError("output_file_name is missing. Run batch-status after the job completes.")

    client = get_client()
    with run_span(
        run_dir=run_dir,
        run_name=args.run_name,
        span_name="fetch-batch-output",
        input_payload={"output_file_name": output_file_name},
    ) as span:
        output_file = client.files.get(name=output_file_name)
        output_bytes = client.files.download(file=output_file)
        output_path.write_bytes(output_bytes)
        if span is not None:
            span.update(output={"batch_output_path": str(output_path)})
    print(f"Downloaded batch output to {output_path}")


def cmd_wait_batch(args: argparse.Namespace) -> None:
    run_dir = get_run_dir(args.run_name)
    deadline = time.time() + args.timeout_seconds
    terminal_states = {
        "JOB_STATE_SUCCEEDED",
        "JOB_STATE_FAILED",
        "JOB_STATE_CANCELLED",
        "JOB_STATE_EXPIRED",
    }

    with run_span(
        run_dir=run_dir,
        run_name=args.run_name,
        span_name="wait-batch",
        input_payload={
            "poll_interval_seconds": args.poll_seconds,
            "timeout_seconds": args.timeout_seconds,
            "fetch_output": args.fetch_output,
            "parse_output": args.parse_output,
        },
    ) as span:
        last_state = None
        while True:
            updated = get_batch_status(run_dir=run_dir, run_name=args.run_name, traced=False)
            state = updated.get("state")
            output_file_name = updated.get("output_file_name")

            if state != last_state:
                print(json.dumps(updated, ensure_ascii=False, indent=2))
                last_state = state

            if output_file_name and state in terminal_states:
                break

            if state in terminal_states and not output_file_name:
                raise RuntimeError(f"Batch finished in state {state}, but no output_file_name was provided.")

            if time.time() >= deadline:
                raise TimeoutError(
                    f"Timed out waiting for batch completion after {args.timeout_seconds} seconds. "
                    f"Last known state: {state}"
                )

            time.sleep(args.poll_seconds)

        if args.fetch_output:
            cmd_fetch_output(argparse.Namespace(run_name=args.run_name))
        if args.parse_output:
            cmd_parse_output(argparse.Namespace(run_name=args.run_name))

        if span is not None:
            span.update(
                output={
                    "state": state,
                    "output_file_name": output_file_name,
                    "fetched_output": args.fetch_output,
                    "parsed_output": args.parse_output,
                }
            )


def extract_response_text(response_obj: dict[str, Any]) -> str:
    candidates = response_obj.get("candidates", [])
    for candidate in candidates:
        content = candidate.get("content", {})
        for part in content.get("parts", []):
            text = part.get("text")
            if text:
                return text.strip()
    return ""


def extract_usage_details(response_obj: dict[str, Any]) -> dict[str, Any] | None:
    usage = response_obj.get("usageMetadata") or response_obj.get("usage_metadata")
    if not isinstance(usage, dict):
        return None

    details: dict[str, Any] = {}
    if "promptTokenCount" in usage:
        details["prompt_tokens"] = usage["promptTokenCount"]
    if "candidatesTokenCount" in usage:
        details["completion_tokens"] = usage["candidatesTokenCount"]
    if "totalTokenCount" in usage:
        details["total_tokens"] = usage["totalTokenCount"]
    if "cachedContentTokenCount" in usage:
        details["prompt_tokens_details"] = {"cached_tokens": usage["cachedContentTokenCount"]}
    return details or None


def parse_batch_line(row: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    key = row.get("key", "")
    error = row.get("error")
    if error:
        return None, {"key": key, "error": error}

    response_obj = row.get("response", row)
    text = extract_response_text(response_obj)
    if not text:
        return None, {"key": key, "error": "No text payload found in batch response", "raw": row}

    if text.startswith("```"):
        parts = text.split("```")
        if len(parts) > 1:
            text = parts[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    usage_details = extract_usage_details(response_obj)
    try:
        payload = json.loads(text)
        parsed = {"key": key, "result": payload}
        if usage_details:
            parsed["usage_details"] = usage_details
        return parsed, None
    except json.JSONDecodeError as exc:
        return None, {"key": key, "error": f"JSON parse failed: {exc}", "raw_text": text}


def load_manifest_filename_map(run_dir: Path) -> dict[str, str]:
    manifest_path = run_dir / "manifest.json"
    manifest = read_json(manifest_path)
    return {item["request_key"]: item["filename"] for item in manifest["files"]}


def cmd_parse_output(args: argparse.Namespace) -> None:
    run_dir = get_run_dir(args.run_name)
    results_path = run_dir / "results.json"
    errors_path = run_dir / "errors.json"
    if results_path.exists() and errors_path.exists():
        print(f"Parsed output already exists: {results_path}")
        return

    rows = read_jsonl(run_dir / "batch_output.jsonl")
    manifest_filename_map = load_manifest_filename_map(run_dir)
    results: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    with run_span(
        run_dir=run_dir,
        run_name=args.run_name,
        span_name="parse-batch-output",
        input_payload={"row_count": len(rows)},
        metadata={"model": GEMINI_MODEL},
    ) as span:
        for row in rows:
            ok, err = parse_batch_line(row)
            if ok:
                ok["result"]["filename"] = manifest_filename_map.get(ok["key"], ok["result"].get("filename", ""))
                with start_generation(
                    run_dir=run_dir,
                    run_name=args.run_name,
                    name="batch-result",
                    model=GEMINI_MODEL,
                    input_payload={"key": ok["key"]},
                    metadata={"source": "batch_output.jsonl"},
                ) as generation:
                    if generation is not None:
                        generation.update(
                            output=ok["result"],
                            usage_details=ok.get("usage_details"),
                        )
                results.append(ok)
            if err:
                errors.append(err)

        write_json(results_path, {"run_name": args.run_name, "results": results})
        write_json(errors_path, {"run_name": args.run_name, "errors": errors})
        if span is not None:
            span.update(output={"results": len(results), "errors": len(errors)})

    print(f"Parsed results: {len(results)}")
    print(f"Parse errors: {len(errors)}")


def cmd_cleanup_files(args: argparse.Namespace) -> None:
    run_dir = get_run_dir(args.run_name)
    client = get_client()

    uploads_path = run_dir / "uploads.json"
    deleted_count = 0
    with run_span(
        run_dir=run_dir,
        run_name=args.run_name,
        span_name="cleanup-gemini-files",
    ) as span:
        if uploads_path.exists():
            uploads_payload = read_json(uploads_path)
            for upload in uploads_payload["uploads"]:
                try:
                    client.files.delete(name=upload["file_name"])
                    deleted_count += 1
                    print(f"Deleted uploaded file: {upload['file_name']}")
                except Exception as exc:
                    print(f"Skipping uploaded file delete for {upload['file_name']}: {exc}")

        job_path = run_dir / "batch_job.json"
        if job_path.exists():
            job_payload = read_json(job_path)
            input_file_name = job_payload.get("input_file_name")
            if input_file_name:
                try:
                    client.files.delete(name=input_file_name)
                    deleted_count += 1
                    print(f"Deleted batch input file: {input_file_name}")
                except Exception as exc:
                    print(f"Skipping batch input file delete for {input_file_name}: {exc}")

            output_file_name = job_payload.get("output_file_name")
            if output_file_name:
                try:
                    client.files.delete(name=output_file_name)
                    deleted_count += 1
                    print(f"Deleted batch output file: {output_file_name}")
                except Exception as exc:
                    print(f"Skipping batch output file delete for {output_file_name}: {exc}")
        if span is not None:
            span.update(output={"deleted_count": deleted_count})


def cmd_process_run(args: argparse.Namespace) -> None:
    run_dir = get_run_dir(args.run_name)
    with run_span(
        run_dir=run_dir,
        run_name=args.run_name,
        span_name="process-run",
        input_payload={
            "run_name": args.run_name,
            "fetch_output": True,
            "parse_output": True,
            "cleanup_files": args.cleanup_files,
        },
        metadata={"mode": "batch-resume-safe"},
    ) as span:
        cmd_upload(argparse.Namespace(run_name=args.run_name))
        cmd_build_batch(argparse.Namespace(run_name=args.run_name))
        cmd_create_batch(argparse.Namespace(run_name=args.run_name))
        cmd_wait_batch(
            argparse.Namespace(
                run_name=args.run_name,
                poll_seconds=args.poll_seconds,
                timeout_seconds=args.timeout_seconds,
                fetch_output=True,
                parse_output=True,
            )
        )
        if args.cleanup_files:
            cmd_cleanup_files(argparse.Namespace(run_name=args.run_name))

        if span is not None:
            span.update(output={"completed": True, "cleanup_files": args.cleanup_files})


def cmd_process_split(args: argparse.Namespace) -> None:
    run_dir = get_run_dir(args.run_name)
    split_payload = read_json(run_dir / "split_runs.json")
    child_runs = split_payload["child_runs"]
    if args.limit is not None:
        child_runs = child_runs[: args.limit]

    with run_span(
        run_dir=run_dir,
        run_name=args.run_name,
        span_name="process-split",
        input_payload={
            "run_name": args.run_name,
            "chunk_count": len(child_runs),
            "cleanup_files": args.cleanup_files,
        },
        metadata={"mode": "batch-resume-safe-split"},
    ) as span:
        completed = 0
        failed = 0
        for child_run_name in child_runs:
            print(f"[chunk] Processing {child_run_name}")
            try:
                cmd_process_run(
                    argparse.Namespace(
                        run_name=child_run_name,
                        poll_seconds=args.poll_seconds,
                        timeout_seconds=args.timeout_seconds,
                        cleanup_files=args.cleanup_files,
                    )
                )
                completed += 1
            except Exception as exc:
                failed += 1
                print(f"[chunk] FAILED {child_run_name}: {exc}")
                if not args.continue_on_error:
                    raise

        if span is not None:
            span.update(output={"completed": completed, "failed": failed, "total": len(child_runs)})

    print(f"Split processing complete: completed={completed}, failed={failed}, total={len(child_runs)}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Gemini Batch audio classification helper")
    sub = parser.add_subparsers(dest="command", required=True)
    group_choices = ["foley", "hard_sfx", "cinematic", "ambience", "music", "dialogue_vo"]

    p_sample = sub.add_parser("sample", help="Sample audio files into a test run manifest")
    p_sample.add_argument("--group", choices=group_choices, required=True)
    p_sample.add_argument("--count", type=int, default=30)
    p_sample.add_argument("--seed", type=int, default=104)
    p_sample.add_argument("--run-name", required=True)
    p_sample.set_defaults(func=cmd_sample)

    p_prepare = sub.add_parser("prepare-run", help="Prepare a full manifest from Foley, Hard_SFX, or both")
    p_prepare.add_argument("--group", choices=group_choices + ["all"], required=True)
    p_prepare.add_argument("--run-name", required=True)
    p_prepare.add_argument("--limit", type=int, help="Optional limit for prepared files")
    p_prepare.set_defaults(func=cmd_prepare_run)

    p_split = sub.add_parser("split-run", help="Split an existing manifest into chunked child runs")
    p_split.add_argument("--run-name", required=True)
    p_split.add_argument("--chunk-size", type=int, required=True)
    p_split.set_defaults(func=cmd_split_run)

    p_upload = sub.add_parser("upload", help="Upload manifest files to Gemini Files API")
    p_upload.add_argument("--run-name", required=True)
    p_upload.set_defaults(func=cmd_upload)

    p_build = sub.add_parser("build-batch", help="Build Batch API JSONL from uploads.json")
    p_build.add_argument("--run-name", required=True)
    p_build.set_defaults(func=cmd_build_batch)

    p_sync = sub.add_parser("sync-analyze", help="Run a direct non-batch Gemini call for one sampled file")
    p_sync.add_argument("--run-name", required=True)
    p_sync.add_argument("--key", required=True, help="request_key from manifest.json, e.g. foley-001")
    p_sync.set_defaults(func=cmd_sync_analyze)

    p_sync_run = sub.add_parser("sync-run", help="Run direct non-batch Gemini calls for all sampled files in a run")
    p_sync_run.add_argument("--run-name", required=True)
    p_sync_run.add_argument("--limit", type=int, help="Optional limit for how many manifest items to analyze")
    p_sync_run.set_defaults(func=cmd_sync_run)

    p_merge_sync = sub.add_parser(
        "merge-sync-results",
        help="Merge legacy per-file sync_result_*.json files into sync_results.json",
    )
    p_merge_sync.add_argument("--run-name", required=True)
    p_merge_sync.add_argument("--delete-individual", action="store_true")
    p_merge_sync.set_defaults(func=cmd_merge_sync_results)

    p_process_sync = sub.add_parser("process-run-sync", help="Resume-safe sync processing for one prepared run")
    p_process_sync.add_argument("--run-name", required=True)
    p_process_sync.add_argument("--limit", type=int, help="Optional limit for how many manifest items to analyze")
    p_process_sync.set_defaults(func=cmd_process_run_sync)

    p_process_split_sync = sub.add_parser(
        "process-split-sync",
        help="Resume-safe sync processing for all chunked child runs",
    )
    p_process_split_sync.add_argument("--run-name", required=True, help="Parent run name that owns split_runs.json")
    p_process_split_sync.add_argument("--continue-on-error", action="store_true")
    p_process_split_sync.add_argument("--limit", type=int, help="Optional number of child chunks to process")
    p_process_split_sync.set_defaults(func=cmd_process_split_sync)

    p_create = sub.add_parser("create-batch", help="Upload batch JSONL and create a batch job")
    p_create.add_argument("--run-name", required=True)
    p_create.set_defaults(func=cmd_create_batch)

    p_status = sub.add_parser("batch-status", help="Check batch job status")
    p_status.add_argument("--run-name", required=True)
    p_status.set_defaults(func=cmd_batch_status)

    p_wait = sub.add_parser(
        "wait-batch",
        help="Poll batch status until completion, then optionally fetch and parse output",
    )
    p_wait.add_argument("--run-name", required=True)
    p_wait.add_argument("--poll-seconds", type=int, default=120)
    p_wait.add_argument("--timeout-seconds", type=int, default=7200)
    p_wait.add_argument("--fetch-output", action="store_true")
    p_wait.add_argument("--parse-output", action="store_true")
    p_wait.set_defaults(func=cmd_wait_batch)

    p_fetch = sub.add_parser("fetch-output", help="Download batch output JSONL")
    p_fetch.add_argument("--run-name", required=True)
    p_fetch.set_defaults(func=cmd_fetch_output)

    p_parse = sub.add_parser("parse-output", help="Parse batch output JSONL into local JSON files")
    p_parse.add_argument("--run-name", required=True)
    p_parse.set_defaults(func=cmd_parse_output)

    p_cleanup = sub.add_parser("cleanup-files", help="Delete uploaded Gemini files for a run")
    p_cleanup.add_argument("--run-name", required=True)
    p_cleanup.set_defaults(func=cmd_cleanup_files)

    p_process = sub.add_parser("process-run", help="Resume-safe batch processing for one prepared run")
    p_process.add_argument("--run-name", required=True)
    p_process.add_argument("--poll-seconds", type=int, default=120)
    p_process.add_argument("--timeout-seconds", type=int, default=7200)
    p_process.add_argument("--cleanup-files", action="store_true")
    p_process.set_defaults(func=cmd_process_run)

    p_process_split = sub.add_parser("process-split", help="Resume-safe batch processing for all chunked child runs")
    p_process_split.add_argument("--run-name", required=True, help="Parent run name that owns split_runs.json")
    p_process_split.add_argument("--poll-seconds", type=int, default=120)
    p_process_split.add_argument("--timeout-seconds", type=int, default=7200)
    p_process_split.add_argument("--cleanup-files", action="store_true")
    p_process_split.add_argument("--continue-on-error", action="store_true")
    p_process_split.add_argument("--limit", type=int, help="Optional number of child chunks to process")
    p_process_split.set_defaults(func=cmd_process_split)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    try:
        args.func(args)
    finally:
        flush_langfuse()


if __name__ == "__main__":
    main()
