# Vector Search Test Schema

## Goal

- Store local Foley and Hard_SFX audio file paths.
- Store LLM description results for each audio file.
- Store embeddings for `short_caption_en`, `long_caption_en`, and combined variants.
- Store video analysis events from the external LLM JSON.
- Compare each event `description` embedding against stored audio description embeddings.
- Save retrieval results for evaluation.

## Table Roles

- `audio_assets`
  - One row per real audio file.
  - Keeps the local file path and folder path metadata.

- `audio_descriptions`
  - One row per LLM analysis result for an audio file.
  - Keeps `short_caption_en`, `long_caption_en`, `tags_structured`, and raw JSON.

- `audio_embeddings`
  - One row per embedding target for an audio description.
  - Recommended first pass:
    - `short_caption`
    - `long_caption`
    - `combined_caption`
  - `tags_structured` is stored in `audio_descriptions`, but not embedded in the first version.

- `video_query_events`
  - One row per event in the external video analysis JSON.
  - Stores `track`, `category_path`, `description`, and `video_context`.

- `video_query_embeddings`
  - One row per query embedding version for a video event.
  - Recommended first pass:
    - `description`
  - Optional later experiment:
    - `description_with_context`

- `retrieval_results`
  - Stores top-k match results for evaluation.

## Recommended Retrieval Flow

1. Load audio JSON results from `gemini-audio-classify/result`.
2. Match each JSON row to a real file path under `sound_library/Foley` or `sound_library/Hard_SFX`.
3. Insert into `audio_assets` and `audio_descriptions`.
4. Generate embeddings and insert into `audio_embeddings`.
5. Load external video JSON events into `video_query_events`.
6. Generate query embeddings and insert into `video_query_embeddings`.
7. Search with this order:
   - hard filter by `track`
   - vector similarity on caption embeddings
   - rerank with `category_path` and `tags_structured`
8. Save ranked matches in `retrieval_results`.

## Notes

- `track` should be treated as a hard filter first.
- `category_path` should be used as a reranking signal, not a strict filter in the first version.
- `video_context` should not be the main query text for Foley/SFX retrieval.
- `tags_structured` should be stored now, but it is safer to use it later as a reranking or secondary embedding experiment.
