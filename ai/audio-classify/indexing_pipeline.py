"""Asset indexing pipeline — §7  Asset Indexing Pipeline.

Pipeline steps (§7.1):
  1. ingest raw sound asset
  2. preprocess and validate audio
  3. run classification / caption / tag generation
  4. normalize generated text
  5. generate text embedding
  6. generate audio embedding
  7. store metadata + embeddings
  8. update retrieval index

Detailed rules (§7.2):
  A. Audio preprocessing — flag long/noisy clips
  B. Caption generation — short + long captions
  C. Structured tag extraction
  D. Embedding generation — text from captions+tags, audio from clip
  E. Versioning — always store model name/version/dimensionality
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path

from config import CAPTION_MODEL, EMBEDDING_MODEL, SOUND_LIBRARY_ROOT
from db import Database
from models import AudioAsset, StructuredTags

import caption_service
import embedding_service


# ── Audio file extensions ───────────────────────────────────
AUDIO_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg", ".aac", ".m4a", ".wma"}

# ── MIME type mapping ───────────────────────────────────────
MIME_MAP = {
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".aac": "audio/aac",
    ".m4a": "audio/mp4",
    ".wma": "audio/x-ms-wma",
}


def _get_audio_metadata(file_path: str) -> dict:
    """Extract duration, sample_rate, channels using ffprobe or mutagen."""
    meta = {"duration_ms": 0, "sample_rate": 0, "channels": 0}

    # Try mutagen first
    try:
        import mutagen
        audio = mutagen.File(file_path)
        if audio is not None:
            meta["duration_ms"] = int((audio.info.length or 0) * 1000)
            meta["sample_rate"] = getattr(audio.info, "sample_rate", 0)
            meta["channels"] = getattr(audio.info, "channels", 0)
            return meta
    except Exception:
        pass

    # Fallback to ffprobe
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-print_format", "json",
                "-show_format", "-show_streams",
                file_path,
            ],
            capture_output=True, text=True,
        )
        if result.returncode == 0:
            info = json.loads(result.stdout)
            fmt = info.get("format", {})
            meta["duration_ms"] = int(float(fmt.get("duration", 0)) * 1000)
            for stream in info.get("streams", []):
                if stream.get("codec_type") == "audio":
                    meta["sample_rate"] = int(stream.get("sample_rate", 0))
                    meta["channels"] = int(stream.get("channels", 0))
                    break
    except Exception:
        pass

    return meta


def _normalize_title(filename: str) -> str:
    """Create a search-normalized title from filename."""
    name = Path(filename).stem
    # Replace underscores, hyphens, camelCase with spaces
    name = re.sub(r"[_\-]", " ", name)
    name = re.sub(r"([a-z])([A-Z])", r"\1 \2", name)
    # Remove numbering patterns like _01, _v2
    name = re.sub(r"\s*\d+\s*$", "", name)
    return name.strip().lower()


def _build_text_for_embedding(asset: AudioAsset) -> str:
    """§7.2 D — Build text embedding from concatenation of captions + tags."""
    parts = []
    if asset.short_caption_en:
        parts.append(asset.short_caption_en)
    if asset.long_caption_en:
        parts.append(asset.long_caption_en)
    if asset.tags_structured:
        tags_dict = asset.tags_structured.model_dump(exclude_defaults=True)
        if tags_dict:
            parts.append(json.dumps(tags_dict, ensure_ascii=False))
    return " | ".join(parts)


def _generate_aliases(asset: AudioAsset) -> list[str]:
    """Generate keyword aliases for sparse matching (§11.4)."""
    aliases = set()

    # From filename
    stem = Path(asset.original_filename).stem
    aliases.add(stem.lower())
    for word in re.split(r"[_\-\s]+", stem):
        if len(word) > 2:
            aliases.add(word.lower())

    # From normalized title
    for word in asset.normalized_title.split():
        if len(word) > 2:
            aliases.add(word.lower())

    # From tags
    for tag_list in [
        asset.tags_structured.object,
        asset.tags_structured.action,
        asset.tags_structured.material,
    ]:
        for tag in tag_list:
            aliases.add(tag.lower())

    return list(aliases)


def index_audio_file(
    file_path: str,
    db: Database,
    asset_id: str | None = None,
    use_audio_for_caption: bool = True,
) -> AudioAsset:
    """Index a single audio file through the full pipeline.

    Args:
        file_path: Path to the audio file.
        db: Database instance.
        asset_id: Custom asset ID (defaults to filename stem).
        use_audio_for_caption: If True, send audio to Gemma 4 for captioning.
            If False, use filename-based text captioning (for testing).

    Returns:
        The fully populated AudioAsset.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {file_path}")

    ext = path.suffix.lower()
    mime_type = MIME_MAP.get(ext, "audio/wav")

    # §7.1 Step 1: Ingest
    asset_id = asset_id or path.stem
    print(f"[index] {asset_id}: ingesting {path.name}")

    # §7.1 Step 2: Preprocess / validate
    meta = _get_audio_metadata(str(path))
    normalized_title = _normalize_title(path.name)

    # §7.2 A: Flag clips with issues
    if meta["duration_ms"] > 30_000:
        print(f"[index] {asset_id}: WARNING — clip is {meta['duration_ms']}ms (>30s), may need segmentation")

    # §7.1 Step 3: Classification / caption / tag generation
    audio_bytes = path.read_bytes()

    if use_audio_for_caption:
        try:
            caption_result = caption_service.classify_and_caption_audio(
                audio_bytes=audio_bytes,
                mime_type=mime_type,
                filename=path.name,
            )
        except Exception as e:
            print(f"[index] {asset_id}: audio captioning failed ({e}), falling back to text")
            caption_result = caption_service.classify_and_caption_from_text(
                description=normalized_title,
                filename=path.name,
            )
    else:
        caption_result = caption_service.classify_and_caption_from_text(
            description=normalized_title,
            filename=path.name,
        )

    primary_class, secondary, confidence, short_cap, long_cap, tags = (
        caption_service.parse_caption_result(caption_result)
    )

    # §7.1 Step 4: Normalize
    asset = AudioAsset(
        asset_id=asset_id,
        original_filename=path.name,
        normalized_title=normalized_title,
        duration_ms=meta["duration_ms"],
        sample_rate=meta["sample_rate"],
        channels=meta["channels"],
        storage_uri=str(path.absolute()),
        primary_class=primary_class,
        secondary_candidates=secondary,
        class_confidence=confidence,
        short_caption_en=short_cap,
        long_caption_en=long_cap,
        tags_structured=tags,
        embedding_model_version=embedding_service.get_model_version(),
        caption_model_version=CAPTION_MODEL,
    )

    # §7.1 Step 5: Text embedding
    text_for_emb = _build_text_for_embedding(asset)
    print(f"[index] {asset_id}: generating text embedding")
    text_emb = embedding_service.embed_document(
        content=text_for_emb,
        title=asset.normalized_title,
    )
    asset.text_embedding = text_emb

    # §7.1 Step 6: Audio embedding
    print(f"[index] {asset_id}: generating audio embedding")
    try:
        audio_emb = embedding_service.embed_audio(audio_bytes, mime_type)
        asset.audio_embedding = audio_emb
    except Exception as e:
        print(f"[index] {asset_id}: audio embedding failed ({e}), storing text emb only")
        asset.audio_embedding = text_emb  # fallback: use text emb

    # §7.1 Step 7: Store metadata + embeddings
    db.insert_asset(asset)
    db.insert_text_embedding(asset_id, text_emb)
    db.insert_audio_embedding(asset_id, asset.audio_embedding)

    # Generate and store aliases for sparse matching
    aliases = _generate_aliases(asset)
    for alias in aliases:
        db.insert_alias(asset_id, alias)

    print(f"[index] {asset_id}: done — class={primary_class} conf={confidence:.2f}")
    return asset


def index_directory(
    audio_dir: str | None = None,
    db: Database | None = None,
    use_audio_for_caption: bool = True,
) -> list[AudioAsset]:
    """Index all audio files in a directory.

    Args:
        audio_dir: Path to directory containing audio files.
        db: Database instance (created if None).
        use_audio_for_caption: Pass audio data to Gemma 4.

    Returns:
        List of indexed AudioAsset objects.
    """
    audio_dir = audio_dir or SOUND_LIBRARY_ROOT
    if db is None:
        db = Database()

    root = Path(audio_dir)
    if not root.exists():
        raise FileNotFoundError(f"Audio directory not found: {audio_dir}")

    files = [
        f for f in sorted(root.iterdir())
        if f.is_file() and f.suffix.lower() in AUDIO_EXTENSIONS
    ]

    if not files:
        print(f"[index] No audio files found in {audio_dir}")
        return []

    print(f"[index] Found {len(files)} audio files in {audio_dir}")

    assets = []
    for i, file_path in enumerate(files, 1):
        print(f"\n[index] === {i}/{len(files)} ===")
        try:
            asset = index_audio_file(
                str(file_path), db,
                use_audio_for_caption=use_audio_for_caption,
            )
            assets.append(asset)
        except Exception as e:
            print(f"[index] FAILED {file_path.name}: {e}")

    print(f"\n[index] Indexing complete: {len(assets)}/{len(files)} assets indexed")
    return assets
