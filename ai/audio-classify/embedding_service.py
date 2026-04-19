"""Embedding service — §4.2  Gemini Embedding 2.

Responsibilities:
  • audio embedding generation
  • caption text embedding generation
  • query description embedding generation
  • text-to-text retrieval
  • text-to-audio reranking

Store:
  • text_embedding
  • audio_embedding
  • embedding_model_version

Supports re-indexing by storing model version metadata.
"""

from __future__ import annotations

import numpy as np
from google import genai
from google.genai import types

from config import EMBEDDING_DIM, EMBEDDING_MODEL, GOOGLE_API_KEY


def _get_client() -> genai.Client:
    if not GOOGLE_API_KEY:
        raise EnvironmentError("GOOGLE_API_KEY is not set. Check .env file.")
    return genai.Client(api_key=GOOGLE_API_KEY)


def _normalize(vec: list[float]) -> list[float]:
    """L2-normalize a vector (required for dims other than 3072)."""
    arr = np.array(vec, dtype=np.float32)
    norm = np.linalg.norm(arr)
    if norm > 0:
        arr = arr / norm
    return arr.tolist()


# ── Text embedding ──────────────────────────────────────────

def embed_text(text: str, normalize: bool = True) -> list[float]:
    """Generate a text embedding using Gemini Embedding 2.

    Per spec §7.2 D, build text embedding from concatenation of
    short_caption_en + long_caption_en + serialized structured tags.
    """
    client = _get_client()
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIM),
    )
    vec = result.embeddings[0].values
    if normalize and EMBEDDING_DIM != 3072:
        vec = _normalize(vec)
    return vec


def embed_texts_batch(texts: list[str], normalize: bool = True) -> list[list[float]]:
    """Batch text embedding generation."""
    client = _get_client()
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=texts,
        config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIM),
    )
    vecs = [e.values for e in result.embeddings]
    if normalize and EMBEDDING_DIM != 3072:
        vecs = [_normalize(v) for v in vecs]
    return vecs


# ── Audio embedding ─────────────────────────────────────────

def embed_audio(audio_bytes: bytes, mime_type: str = "audio/wav", normalize: bool = True) -> list[float]:
    """Generate an audio embedding using Gemini Embedding 2.

    Per spec §4.2, uses gemini-embedding-2-preview which supports
    text, images, video, audio, and documents in a unified embedding space.
    """
    client = _get_client()
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=[
            types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
        ],
        config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIM),
    )
    vec = result.embeddings[0].values
    if normalize and EMBEDDING_DIM != 3072:
        vec = _normalize(vec)
    return vec


# ── Query embedding ─────────────────────────────────────────

def embed_query(query_text: str, normalize: bool = True) -> list[float]:
    """Generate a query text embedding for retrieval.

    Uses the asymmetric retrieval format recommended by Gemini Embedding 2:
      task: search result | query: {content}
    """
    formatted = f"task: search result | query: {query_text}"
    client = _get_client()
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=formatted,
        config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIM),
    )
    vec = result.embeddings[0].values
    if normalize and EMBEDDING_DIM != 3072:
        vec = _normalize(vec)
    return vec


def embed_document(content: str, title: str | None = None, normalize: bool = True) -> list[float]:
    """Generate a document text embedding for indexing.

    Uses the asymmetric retrieval format:
      title: {title} | text: {content}
    """
    title_str = title if title else "none"
    formatted = f"title: {title_str} | text: {content}"
    client = _get_client()
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=formatted,
        config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIM),
    )
    vec = result.embeddings[0].values
    if normalize and EMBEDDING_DIM != 3072:
        vec = _normalize(vec)
    return vec


# ── Cosine similarity ──────────────────────────────────────

def cosine_similarity(a: list[float] | np.ndarray, b: list[float] | np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    a_arr = np.array(a, dtype=np.float32)
    b_arr = np.array(b, dtype=np.float32)
    dot = np.dot(a_arr, b_arr)
    norm_a = np.linalg.norm(a_arr)
    norm_b = np.linalg.norm(b_arr)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))


# ── Metadata ────────────────────────────────────────────────

def get_model_version() -> str:
    """Return the current embedding model identifier for versioning (§7.2 E)."""
    return EMBEDDING_MODEL


def get_embedding_dim() -> int:
    """Return the current embedding dimensionality."""
    return EMBEDDING_DIM
