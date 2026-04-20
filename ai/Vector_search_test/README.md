# Vector Search Test

This folder now owns only the video-event search side of the PoC.

Moved out to `ai/custom_library`:

- S3 audio object listing
- `gemini-audio-classify` result JSON loading
- audio caption/tag storage
- audio caption embedding generation

Kept here:

- external video-analysis JSON loading
- track event extraction
- event description query embedding
- vector similarity search against existing audio embeddings
- category/tags/class reranking
- retrieval result storage

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
python load_video_events.py
python search_events.py
```

Before running `search_events.py`, audio tables must already contain indexed audio descriptions and embeddings. For the current PoC, generate them from:

```powershell
cd ..\custom_library
python load_audio_assets.py
python embed_audio_texts.py
```

## Langfuse

- Query embedding calls are instrumented in `embedding.py`.
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
