from __future__ import annotations

import json

from google import genai
from google.genai import types

from langfuse_client import start_generation, update_generation
from settings import (
    DEBUG_EMBEDDING_RESPONSE,
    EMBEDDING_DIM,
    EMBEDDING_MODEL,
    ENABLE_TOKEN_COUNT,
    GOOGLE_API_KEY,
)


_debug_dump_done = False
_token_count_cache: dict[str, int | None] = {}


def get_client() -> genai.Client:
    if not GOOGLE_API_KEY:
        raise EnvironmentError("GOOGLE_API_KEY is not set in .env")
    return genai.Client(api_key=GOOGLE_API_KEY)


def _safe_model_dump(response) -> str:
    if hasattr(response, "model_dump"):
        try:
            return json.dumps(response.model_dump(), ensure_ascii=False, indent=2, default=str)
        except Exception:
            pass
    if hasattr(response, "__dict__"):
        try:
            return json.dumps(response.__dict__, ensure_ascii=False, indent=2, default=str)
        except Exception:
            pass
    return repr(response)


def _maybe_debug_response(response) -> None:
    global _debug_dump_done
    if not DEBUG_EMBEDDING_RESPONSE or _debug_dump_done:
        return

    _debug_dump_done = True
    print("[embedding.debug] Response preview start")
    print(_safe_model_dump(response))
    print("[embedding.debug] Response preview end")


def _extract_usage(response):
    usage = getattr(response, "usage_metadata", None) or getattr(response, "usage", None)
    if usage is None:
        return None
    if hasattr(usage, "model_dump"):
        try:
            return usage.model_dump()
        except Exception:
            return None
    if isinstance(usage, dict):
        return usage
    if hasattr(usage, "__dict__"):
        return dict(usage.__dict__)
    return None


def count_tokens(text: str) -> int | None:
    if not ENABLE_TOKEN_COUNT:
        return None
    if text in _token_count_cache:
        return _token_count_cache[text]

    client = get_client()
    try:
        response = client.models.count_tokens(
            model=EMBEDDING_MODEL,
            contents=text,
        )
    except Exception:
        _token_count_cache[text] = None
        return None

    token_count = None
    if hasattr(response, "total_tokens"):
        token_count = getattr(response, "total_tokens")
    elif hasattr(response, "total_billable_characters"):
        token_count = getattr(response, "total_billable_characters")
    elif hasattr(response, "__dict__"):
        token_count = response.__dict__.get("total_tokens")

    token_count = int(token_count) if token_count is not None else None
    _token_count_cache[text] = token_count
    return token_count


def embed_document(text: str) -> list[float]:
    client = get_client()
    token_count = count_tokens(text)
    with start_generation(
        name="embed_document",
        model=EMBEDDING_MODEL,
        input_payload={"text": text},
        metadata={
            "task_type": "RETRIEVAL_DOCUMENT",
            "embedding_dim": EMBEDDING_DIM,
            "input_char_count": len(text),
            "input_token_count": token_count,
        },
    ) as generation:
        response = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=text,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_DOCUMENT",
                output_dimensionality=EMBEDDING_DIM,
            ),
        )
        _maybe_debug_response(response)
        update_generation(
            generation,
            output={
                "embedding_count": len(response.embeddings),
                "embedding_dim": len(response.embeddings[0].values),
            },
            usage=_extract_usage(response),
        )
    return list(response.embeddings[0].values)

