# Vector Search Test

## Fixed Decisions

- Work only inside this folder.
- Use PostgreSQL + pgvector.
- Store Foley and Hard_SFX file paths from the local sound library.
- Store LLM outputs from `gemini-audio-classify/result`.
- Embed only:
  - `short_caption_en`
  - `long_caption_en`
  - `combined_caption`
- Do not embed `tags_structured` in the first version.
- Use external video event `description` as the main query text.
- Use `track` as the first hard filter.
- Use `categoryPath` and `tags` as reranking signals.
- Keep `videoContext` stored, but do not make it the default query for Foley/SFX retrieval.
- Run local PostgreSQL with pgvector through `docker compose` on port `5433`.

## Tables

- `audio_assets`
  - Real audio file identity and file path.
- `audio_descriptions`
  - LLM caption output for each audio asset.
- `audio_embeddings`
  - Caption embeddings for retrieval experiments.
- `video_query_events`
  - External LLM event rows from the video analysis JSON.
- `video_query_embeddings`
  - Query embeddings for each event.
- `retrieval_results`
  - Ranked retrieval outputs for evaluation.

## Retrieval Strategy

1. Filter candidates by `track`.
2. Compare event `description` embedding against stored audio caption embeddings.
3. Start with `combined_caption` as the default retrieval target.
4. Optionally compare against `short_caption` and `long_caption` separately for evaluation.
5. Rerank with:
   - `categoryPath`
   - event `tags`
   - audio `primary_class` / `second_class`
   - stored `tags_structured`

## Next Files To Add

- `init_db.py`
  - Create schema from `schema.sql`.
- `load_audio_assets.py`
  - Parse audio JSON files and register local audio paths.
- `embed_audio_texts.py`
  - Create caption embeddings and store them.
- `load_video_events.py`
  - Parse the external video analysis JSON.
- `search_events.py`
  - Run vector search and save ranked results.

## Local DB Setup

1. Copy `.env.example` to `.env`.
2. Fill in `GOOGLE_API_KEY`.
3. If you want observability, also fill in:
   - `LANGFUSE_PUBLIC_KEY`
   - `LANGFUSE_SECRET_KEY`
   - `LANGFUSE_HOST=http://localhost:3000`
4. Start PostgreSQL:

```powershell
docker compose up -d
```

5. Initialize schema:

```powershell
python init_db.py
```

6. Load and index data:

```powershell
python load_audio_assets.py
python embed_audio_texts.py
python load_video_events.py
python search_events.py
```

## Langfuse

- Embedding calls are instrumented in `embedding.py`.
- Langfuse will show:
  - each embedding call
  - input text
  - task type
  - input character count
  - input token count when token counting is available
  - output embedding dimension
- For Gemini embeddings, cost may not be computed automatically unless provider usage data is available.
- Token counting can be enabled with `ENABLE_TOKEN_COUNT=true`.
- In the first pass, use Langfuse mainly to inspect call counts, token counts, and payload sizes.
