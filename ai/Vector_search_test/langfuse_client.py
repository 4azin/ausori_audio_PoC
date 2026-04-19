from __future__ import annotations

from contextlib import AbstractContextManager, nullcontext
from typing import Any

from settings import (
    ENABLE_LANGFUSE,
    ENABLE_LANGFUSE_FLUSH,
    LANGFUSE_HOST,
    LANGFUSE_PUBLIC_KEY,
    LANGFUSE_SECRET_KEY,
)


def langfuse_enabled() -> bool:
    return bool(
        ENABLE_LANGFUSE
        and LANGFUSE_PUBLIC_KEY
        and LANGFUSE_SECRET_KEY
        and LANGFUSE_HOST
    )


def get_langfuse():
    if not langfuse_enabled():
        return None
    try:
        from langfuse import Langfuse
    except ModuleNotFoundError:
        return None

    return Langfuse(
        public_key=LANGFUSE_PUBLIC_KEY,
        secret_key=LANGFUSE_SECRET_KEY,
        host=LANGFUSE_HOST,
    )


class _LangfuseGenerationContext(AbstractContextManager):
    def __init__(self, generation: Any, client: Any):
        self.generation = generation
        self.client = client

    def __enter__(self):
        return self.generation

    def __exit__(self, exc_type, exc, tb):
        if self.generation is not None:
            try:
                if exc is None and hasattr(self.generation, "end"):
                    self.generation.end()
                elif exc is not None and hasattr(self.generation, "end"):
                    self.generation.end(
                        level="ERROR",
                        status_message=str(exc),
                    )
            except Exception:
                pass
        return False


def start_generation(
    *,
    name: str,
    model: str,
    input_payload: Any | None = None,
    metadata: dict[str, Any] | None = None,
):
    client = get_langfuse()
    if client is None:
        return nullcontext()

    if hasattr(client, "start_as_current_observation"):
        return client.start_as_current_observation(
            as_type="generation",
            name=name,
            model=model,
            input=input_payload,
            metadata=metadata,
        )

    if hasattr(client, "start_as_current_generation"):
        return client.start_as_current_generation(
            name=name,
            model=model,
            input=input_payload,
            metadata=metadata,
        )

    if hasattr(client, "trace"):
        trace = client.trace(name=f"{name}-trace", input=input_payload, metadata=metadata)
        if hasattr(trace, "generation"):
            generation = trace.generation(
                name=name,
                model=model,
                input=input_payload,
                metadata=metadata,
            )
            return _LangfuseGenerationContext(generation, client)

    return nullcontext()


def update_generation(generation: Any, *, output: Any | None = None, usage: Any | None = None) -> None:
    if generation is None:
        return

    try:
        if hasattr(generation, "update"):
            kwargs = {}
            if output is not None:
                kwargs["output"] = output
            if usage is not None:
                kwargs["usage"] = usage
            generation.update(**kwargs)
            return
    except Exception:
        pass

    try:
        if hasattr(generation, "end"):
            kwargs = {}
            if output is not None:
                kwargs["output"] = output
            if usage is not None:
                kwargs["usage"] = usage
            generation.end(**kwargs)
    except Exception:
        pass


def flush_langfuse() -> None:
    if not ENABLE_LANGFUSE_FLUSH:
        return
    client = get_langfuse()
    if client is not None:
        client.flush()
