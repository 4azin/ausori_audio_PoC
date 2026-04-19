"""Caption / classification / tag service — §4.1  Gemma 4 family.

Responsibilities:
  • sound classification  → primary_class, secondary_candidates
  • English caption generation → short_caption_en, long_caption_en
  • structured tag extraction → tags_structured
  • confidence score

Important (from spec):
  • verify that the chosen Gemma 4 variant actually supports audio input
  • classification quality must be validated with a benchmark set
"""

from __future__ import annotations

import json
from pathlib import Path

from google import genai
from google.genai import types

from config import CAPTION_MODEL, GOOGLE_API_KEY, TAXONOMY_PATH
from models import AudioAsset, StructuredTags


def _load_taxonomy() -> str:
    """Load taxonomy.json and format it for the prompt."""
    path = Path(TAXONOMY_PATH)
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
        return json.dumps(data, indent=2, ensure_ascii=False)
    return "{}"


_TAXONOMY_STR = _load_taxonomy()

_SYSTEM_PROMPT = f"""\
You are an expert sound librarian and audio classification engine.

Given an audio file, you must produce a structured JSON output with:

1. **primary_class**: Main top-level category. Must be one of:
   foley, sfx, ambience, cinematic, music, dialogue_vo

2. **secondary_candidates**: 2–3 alternative categories that could also apply.

3. **class_confidence**: Float 0.0–1.0 indicating classification certainty.

4. **short_caption_en**: A compact, normalized, retrieval-focused English description.
   Example: "bicycle horn lever repeatedly pressed by finger"

5. **long_caption_en**: A natural, richer descriptive English caption.
   Example: "A person repeatedly presses the lever of a bicycle horn, producing short nasal honks with a close and dry mechanical character."

6. **tags_structured**: A JSON object with these categories:
   - object: physical objects heard/implied
   - action: actions producing the sound
   - material: materials involved
   - texture: acoustic texture descriptors
   - environment: recording environment
   - temporal: temporal pattern (e.g., repetitive, one_shot, sustained)
   - editorial_role: editorial use (e.g., foley, sfx, ambience)
   - realism: "realistic" or "designed"
   - mood: mood descriptors (optional)
   - intensity: intensity descriptors (optional)

[Taxonomy Reference]
{_TAXONOMY_STR}

IMPORTANT RULES:
- Output ONLY valid JSON. No markdown, no explanation.
- Be specific and detailed in captions.
- Tags should be lowercase, underscore-separated.
- If audio is unclear, still produce your best guess with lower confidence.

Output format:
{{
  "primary_class": "...",
  "secondary_candidates": ["...", "..."],
  "class_confidence": 0.0,
  "short_caption_en": "...",
  "long_caption_en": "...",
  "tags_structured": {{
    "object": [],
    "action": [],
    "material": [],
    "texture": [],
    "environment": [],
    "temporal": [],
    "editorial_role": [],
    "realism": "",
    "mood": [],
    "intensity": []
  }}
}}
"""


def _get_client() -> genai.Client:
    if not GOOGLE_API_KEY:
        raise EnvironmentError("GOOGLE_API_KEY is not set. Check .env file.")
    return genai.Client(api_key=GOOGLE_API_KEY)


def classify_and_caption_audio(
    audio_bytes: bytes,
    mime_type: str = "audio/wav",
    filename: str = "",
) -> dict:
    """Send audio to Gemma 4 for classification, captioning, and tagging.

    Returns the raw parsed JSON dict with fields matching the prompt spec.
    """
    client = _get_client()

    parts = [
        types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
    ]
    if filename:
        parts.insert(0, types.Part(text=f"[Filename: {filename}]"))

    response = client.models.generate_content(
        model=CAPTION_MODEL,
        contents=[_SYSTEM_PROMPT] + parts,
    )

    raw = response.text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    return json.loads(raw)


def classify_and_caption_from_text(
    description: str,
    filename: str = "",
) -> dict:
    """Fallback: classify using text description only (no audio input).

    Useful when audio is unavailable or for testing with sample descriptions.
    """
    client = _get_client()

    user_prompt = f"Classify and describe this sound based on the following information.\n"
    if filename:
        user_prompt += f"Filename: {filename}\n"
    user_prompt += f"Description: {description}\n"

    response = client.models.generate_content(
        model=CAPTION_MODEL,
        contents=[_SYSTEM_PROMPT, user_prompt],
    )

    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    return json.loads(raw)


def parse_caption_result(result: dict) -> tuple[str, list[str], float, str, str, StructuredTags]:
    """Parse the raw JSON result into typed fields.

    Returns:
        (primary_class, secondary_candidates, class_confidence,
         short_caption_en, long_caption_en, tags_structured)
    """
    primary_class = result.get("primary_class", "").lower()
    secondary = result.get("secondary_candidates", [])
    confidence = float(result.get("class_confidence", 0.0))
    short_cap = result.get("short_caption_en", "")
    long_cap = result.get("long_caption_en", "")

    tags_raw = result.get("tags_structured", {})
    tags = StructuredTags.model_validate(tags_raw)

    return primary_class, secondary, confidence, short_cap, long_cap, tags
