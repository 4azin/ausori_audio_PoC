"""Database layer — SQLite + numpy vectors.

Schema follows §15 exactly:
  audio_assets, audio_embeddings_text, audio_embeddings_audio,
  audio_aliases, retrieval_logs

Vectors are stored as numpy binary blobs for portability.
Designed for later migration to PostgreSQL + pgvector.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np

from config import DB_PATH
from models import AudioAsset, RetrievalLogEntry, StructuredTags

_SCHEMA = """
-- §15  audio_assets
CREATE TABLE IF NOT EXISTS audio_assets (
    asset_id              TEXT PRIMARY KEY,
    original_filename     TEXT NOT NULL,
    normalized_title      TEXT DEFAULT '',
    duration_ms           INTEGER DEFAULT 0,
    sample_rate           INTEGER DEFAULT 0,
    channels              INTEGER DEFAULT 0,
    storage_uri           TEXT DEFAULT '',
    primary_class         TEXT DEFAULT '',
    secondary_candidates  TEXT DEFAULT '[]',
    class_confidence      REAL DEFAULT 0.0,
    short_caption_en      TEXT DEFAULT '',
    long_caption_en       TEXT DEFAULT '',
    tags_structured       TEXT DEFAULT '{}',
    embedding_model_version TEXT DEFAULT '',
    caption_model_version TEXT DEFAULT '',
    created_at            TEXT,
    updated_at            TEXT
);

-- §15  audio_embeddings_text
CREATE TABLE IF NOT EXISTS audio_embeddings_text (
    asset_id   TEXT PRIMARY KEY REFERENCES audio_assets(asset_id),
    vector     BLOB NOT NULL,
    dimension  INTEGER NOT NULL,
    created_at TEXT
);

-- §15  audio_embeddings_audio
CREATE TABLE IF NOT EXISTS audio_embeddings_audio (
    asset_id   TEXT PRIMARY KEY REFERENCES audio_assets(asset_id),
    vector     BLOB NOT NULL,
    dimension  INTEGER NOT NULL,
    created_at TEXT
);

-- §15  audio_aliases
CREATE TABLE IF NOT EXISTS audio_aliases (
    alias_id   TEXT PRIMARY KEY,
    asset_id   TEXT REFERENCES audio_assets(asset_id),
    alias_text TEXT NOT NULL,
    alias_type TEXT DEFAULT 'keyword'
);

-- §15  retrieval_logs
CREATE TABLE IF NOT EXISTS retrieval_logs (
    request_id        TEXT PRIMARY KEY,
    event_id          TEXT,
    query_payload     TEXT,
    candidate_ids     TEXT,
    selected_asset_id TEXT,
    scores            TEXT,
    created_at        TEXT
);
"""


class Database:
    """SQLite wrapper with vector blob support."""

    def __init__(self, db_path: str | None = None) -> None:
        self._path = db_path or DB_PATH
        self._conn = sqlite3.connect(self._path)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    # ── helpers ─────────────────────────────────────────────
    @staticmethod
    def _vec_to_blob(vec: list[float]) -> bytes:
        return np.array(vec, dtype=np.float32).tobytes()

    @staticmethod
    def _blob_to_vec(blob: bytes) -> np.ndarray:
        return np.frombuffer(blob, dtype=np.float32)

    @staticmethod
    def _now() -> str:
        return datetime.utcnow().isoformat()

    # ── audio_assets ────────────────────────────────────────
    def insert_asset(self, asset: AudioAsset) -> None:
        now = self._now()
        self._conn.execute(
            """INSERT OR REPLACE INTO audio_assets
               (asset_id, original_filename, normalized_title,
                duration_ms, sample_rate, channels, storage_uri,
                primary_class, secondary_candidates, class_confidence,
                short_caption_en, long_caption_en, tags_structured,
                embedding_model_version, caption_model_version,
                created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                asset.asset_id,
                asset.original_filename,
                asset.normalized_title,
                asset.duration_ms,
                asset.sample_rate,
                asset.channels,
                asset.storage_uri,
                asset.primary_class,
                json.dumps(asset.secondary_candidates),
                asset.class_confidence,
                asset.short_caption_en,
                asset.long_caption_en,
                asset.tags_structured.model_dump_json(),
                asset.embedding_model_version,
                asset.caption_model_version,
                now,
                now,
            ),
        )
        self._conn.commit()

    def get_asset(self, asset_id: str) -> AudioAsset | None:
        row = self._conn.execute(
            "SELECT * FROM audio_assets WHERE asset_id = ?", (asset_id,)
        ).fetchone()
        if row is None:
            return None
        return self._row_to_asset(row)

    def list_assets(self) -> list[AudioAsset]:
        rows = self._conn.execute("SELECT * FROM audio_assets").fetchall()
        return [self._row_to_asset(r) for r in rows]

    def _row_to_asset(self, row: sqlite3.Row) -> AudioAsset:
        return AudioAsset(
            asset_id=row["asset_id"],
            original_filename=row["original_filename"],
            normalized_title=row["normalized_title"],
            duration_ms=row["duration_ms"],
            sample_rate=row["sample_rate"],
            channels=row["channels"],
            storage_uri=row["storage_uri"],
            primary_class=row["primary_class"],
            secondary_candidates=json.loads(row["secondary_candidates"]),
            class_confidence=row["class_confidence"],
            short_caption_en=row["short_caption_en"],
            long_caption_en=row["long_caption_en"],
            tags_structured=StructuredTags.model_validate_json(row["tags_structured"]),
            embedding_model_version=row["embedding_model_version"],
            caption_model_version=row["caption_model_version"],
        )

    # ── embeddings ──────────────────────────────────────────
    def insert_text_embedding(self, asset_id: str, vec: list[float]) -> None:
        self._conn.execute(
            """INSERT OR REPLACE INTO audio_embeddings_text
               (asset_id, vector, dimension, created_at)
               VALUES (?, ?, ?, ?)""",
            (asset_id, self._vec_to_blob(vec), len(vec), self._now()),
        )
        self._conn.commit()

    def insert_audio_embedding(self, asset_id: str, vec: list[float]) -> None:
        self._conn.execute(
            """INSERT OR REPLACE INTO audio_embeddings_audio
               (asset_id, vector, dimension, created_at)
               VALUES (?, ?, ?, ?)""",
            (asset_id, self._vec_to_blob(vec), len(vec), self._now()),
        )
        self._conn.commit()

    def get_text_embedding(self, asset_id: str) -> np.ndarray | None:
        row = self._conn.execute(
            "SELECT vector FROM audio_embeddings_text WHERE asset_id = ?",
            (asset_id,),
        ).fetchone()
        return self._blob_to_vec(row["vector"]) if row else None

    def get_audio_embedding(self, asset_id: str) -> np.ndarray | None:
        row = self._conn.execute(
            "SELECT vector FROM audio_embeddings_audio WHERE asset_id = ?",
            (asset_id,),
        ).fetchone()
        return self._blob_to_vec(row["vector"]) if row else None

    def get_all_text_embeddings(self) -> dict[str, np.ndarray]:
        rows = self._conn.execute("SELECT asset_id, vector FROM audio_embeddings_text").fetchall()
        return {r["asset_id"]: self._blob_to_vec(r["vector"]) for r in rows}

    def get_all_audio_embeddings(self) -> dict[str, np.ndarray]:
        rows = self._conn.execute("SELECT asset_id, vector FROM audio_embeddings_audio").fetchall()
        return {r["asset_id"]: self._blob_to_vec(r["vector"]) for r in rows}

    # ── aliases (§11.4 sparse keyword support) ──────────────
    def insert_alias(self, asset_id: str, alias_text: str, alias_type: str = "keyword") -> None:
        self._conn.execute(
            "INSERT OR REPLACE INTO audio_aliases (alias_id, asset_id, alias_text, alias_type) VALUES (?,?,?,?)",
            (str(uuid.uuid4()), asset_id, alias_text, alias_type),
        )
        self._conn.commit()

    def get_aliases(self, asset_id: str) -> list[str]:
        rows = self._conn.execute(
            "SELECT alias_text FROM audio_aliases WHERE asset_id = ?", (asset_id,)
        ).fetchall()
        return [r["alias_text"] for r in rows]

    def get_all_aliases(self) -> dict[str, list[str]]:
        rows = self._conn.execute("SELECT asset_id, alias_text FROM audio_aliases").fetchall()
        result: dict[str, list[str]] = {}
        for r in rows:
            result.setdefault(r["asset_id"], []).append(r["alias_text"])
        return result

    # ── retrieval logs ─────────────────────────────────────
    def log_retrieval(self, entry: RetrievalLogEntry) -> None:
        self._conn.execute(
            """INSERT INTO retrieval_logs
               (request_id, event_id, query_payload, candidate_ids,
                selected_asset_id, scores, created_at)
               VALUES (?,?,?,?,?,?,?)""",
            (
                entry.request_id,
                entry.event_id,
                json.dumps(entry.query_payload),
                json.dumps(entry.candidate_ids),
                entry.selected_asset_id,
                json.dumps(entry.scores),
                self._now(),
            ),
        )
        self._conn.commit()

    # ── cleanup / close ─────────────────────────────────────
    def close(self) -> None:
        self._conn.close()
