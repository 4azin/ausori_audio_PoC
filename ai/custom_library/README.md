# Custom Library Indexing

This folder owns the audio library side of the pipeline.

It handles steps 1-4:

```text
1. List S3 audio objects
2. Read gemini-audio-classify result JSON
3. Store AI caption/tags per audio asset
4. Embed audio captions and store audio embeddings
```

`Vector_search_test` should keep only the video event search/retrieval side.

## Run

```powershell
cd C:\Users\SSAFY\Desktop\FINAL_PJT\final_pjt\S14P31F104\ai\custom_library
python init_db.py
python debug_s3_catalog.py
python load_audio_assets.py
python embed_audio_texts.py
```

## Output Tables

- `audio_assets`
- `audio_descriptions`
- `audio_embeddings`

These are PoC tables. In the backend integration, their equivalents should be:

- `sound_assets`
- `sound_asset_ai_descriptions`
- `sound_asset_ai_embeddings`

