from __future__ import annotations

import json
from contextlib import contextmanager, nullcontext
from pathlib import Path
from typing import Any

from config import LANGFUSE_BASE_URL, LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY


def _langfuse_enabled() -> bool:
    return bool(LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY and LANGFUSE_BASE_URL)


def get_langfuse():
    if not _langfuse_enabled():
        return None
    try:
        from langfuse import get_client
    except ModuleNotFoundError:
        return None
    return get_client()


def get_or_create_trace_id(run_dir: Path, run_name: str) -> str | None:
    langfuse = get_langfuse()
    if langfuse is None:
        return None

    path = run_dir / "run_meta.json"
    if path.exists():
        payload = json.loads(path.read_text(encoding="utf-8"))
    else:
        payload = {"run_name": run_name}

    trace_id = payload.get("trace_id")
    if not trace_id:
        trace_id = langfuse.create_trace_id(seed=run_name)
        payload["trace_id"] = trace_id
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    return trace_id


@contextmanager
def run_span(
    *,
    run_dir: Path,
    run_name: str,
    span_name: str,
    input_payload: Any | None = None,
    metadata: dict[str, Any] | None = None,
):
    langfuse = get_langfuse()
    if langfuse is None:
        yield None
        return

    trace_id = get_or_create_trace_id(run_dir, run_name)
    with langfuse.start_as_current_observation(
        as_type="span",
        name=span_name,
        input=input_payload,
        metadata=metadata,
        trace_context={"trace_id": trace_id} if trace_id else None,
    ) as span:
        try:
            yield span
        finally:
            langfuse.flush()


def start_generation(
    *,
    run_dir: Path,
    run_name: str,
    name: str,
    model: str,
    input_payload: Any | None = None,
    metadata: dict[str, Any] | None = None,
):
    langfuse = get_langfuse()
    if langfuse is None:
        return nullcontext()

    trace_id = get_or_create_trace_id(run_dir, run_name)
    return langfuse.start_as_current_observation(
        as_type="generation",
        name=name,
        model=model,
        input=input_payload,
        metadata=metadata,
        trace_context={"trace_id": trace_id} if trace_id else None,
    )


def flush_langfuse() -> None:
    langfuse = get_langfuse()
    if langfuse is not None:
        langfuse.flush()
