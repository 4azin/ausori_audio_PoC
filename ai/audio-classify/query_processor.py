"""Query processing pipeline — §8  Query Processing Pipeline.

For each event from the upstream system:

§8.1  Step 1: Query normalization
  • Convert raw event JSON into retrieval-friendly query fields.
  • Generate query_class, query_description_raw, query_description_en,
    query_tags_upstream, query_tags_rewritten, query_embedding_text.

Important rule (§8.1):
  Do NOT trust upstream tags blindly.
  Generate a second set of tags from the description itself.
"""

from __future__ import annotations

import json

from google import genai
from google.genai import types

from config import CAPTION_MODEL, GOOGLE_API_KEY
from models import EventQuery, NormalizedQuery, StructuredTags

import embedding_service


_TAG_REWRITE_PROMPT = """\
You are a sound search query optimizer.

Given an event from a video analysis system, rewrite the tags by analyzing the natural-language description.

DO NOT trust the upstream event_tags. Instead, derive your own structured tags from the description.

Output a JSON object with these keys:
- object: physical objects mentioned or implied
- action: actions that produce sound
- material: materials involved
- texture: acoustic qualities implied
- environment: recording environment hints
- temporal: temporal pattern (e.g., repetitive, one_shot, sustained)
- editorial_role: editorial use hint (e.g., foley, sfx, ambience)
- source: sound source type (e.g., mechanical, organic, electronic)

IMPORTANT:
- Output ONLY valid JSON. No markdown, no explanation.
- Tags should be lowercase, underscore-separated.
- Be comprehensive — extract every relevant detail from the description.

Example input:
  event_category: "foley"
  event_tags: ["Material_Texture:Friction", "Cloth:Nylon"]
  description: "The sound of repeatedly pressing the lever on a bicycle horn with a finger."

Example output:
{
  "object": ["bicycle", "horn", "lever", "finger"],
  "action": ["press", "squeeze", "repeat"],
  "material": ["rubber", "metal"],
  "texture": ["short", "nasal", "mechanical"],
  "environment": ["close", "isolated"],
  "temporal": ["repetitive", "one_shot_cluster"],
  "editorial_role": ["foley"],
  "source": ["mechanical"]
}
"""


def _get_client() -> genai.Client:
    if not GOOGLE_API_KEY:
        raise EnvironmentError("GOOGLE_API_KEY is not set. Check .env file.")
    return genai.Client(api_key=GOOGLE_API_KEY)


def _rewrite_tags(event: EventQuery) -> StructuredTags:
    """Generate rewritten tags from description using Gemma 4 (§8.1).

    This is necessary because upstream tags can be noisy or inconsistent.
    """
    client = _get_client()

    user_prompt = (
        f"event_category: \"{event.event_category}\"\n"
        f"event_tags: {json.dumps(event.event_tags)}\n"
        f"description: \"{event.description}\"\n"
    )

    response = client.models.generate_content(
        model=CAPTION_MODEL,
        contents=[_TAG_REWRITE_PROMPT, user_prompt],
    )

    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    parsed = json.loads(raw)

    # Map to StructuredTags (handle 'source' → not a standard field, merge into texture)
    return StructuredTags(
        object=parsed.get("object", []),
        action=parsed.get("action", []),
        material=parsed.get("material", []),
        texture=parsed.get("texture", []) + parsed.get("source", []),
        environment=parsed.get("environment", []),
        temporal=parsed.get("temporal", []),
        editorial_role=parsed.get("editorial_role", []),
    )


def _build_query_text(event: EventQuery, rewritten_tags: StructuredTags) -> str:
    """Build a retrieval-oriented text string for embedding."""
    parts = [event.description]

    # Add rewritten tag context
    tag_words = []
    for tag_list in [
        rewritten_tags.object,
        rewritten_tags.action,
        rewritten_tags.material,
        rewritten_tags.texture,
    ]:
        tag_words.extend(tag_list)
    if tag_words:
        parts.append(" ".join(tag_words))

    return " | ".join(parts)


def normalize_query(event: EventQuery) -> NormalizedQuery:
    """Process a single event into a retrieval-ready normalized query.

    Steps (§8.1):
      1. Extract raw fields
      2. Rewrite tags from description (do NOT trust upstream tags)
      3. Build query text
      4. Generate query embedding
    """
    print(f"[query] {event.event_id}: normalizing query")

    # Rewrite tags from description
    try:
        rewritten_tags = _rewrite_tags(event)
    except Exception as e:
        print(f"[query] {event.event_id}: tag rewriting failed ({e}), using empty tags")
        rewritten_tags = StructuredTags()

    # Build query text for embedding
    query_text = _build_query_text(event, rewritten_tags)

    # Generate query embedding
    print(f"[query] {event.event_id}: generating query embedding")
    query_emb = embedding_service.embed_query(query_text)

    return NormalizedQuery(
        event_id=event.event_id,
        query_class=event.event_category.lower(),
        query_description_raw=event.description,
        query_description_en=event.description,  # Already in English per spec
        query_tags_upstream=event.event_tags,
        query_tags_rewritten=rewritten_tags,
        query_embedding_text=query_emb,
    )


def normalize_queries(events: list[EventQuery]) -> list[NormalizedQuery]:
    """Process multiple events."""
    return [normalize_query(e) for e in events]
