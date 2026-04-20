BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS audio_assets (
    id BIGSERIAL PRIMARY KEY,
    asset_key VARCHAR(120) NOT NULL UNIQUE,
    source_group VARCHAR(20) NOT NULL,
    original_filename TEXT NOT NULL,
    s3_bucket TEXT,
    s3_key TEXT,
    local_file_path TEXT,
    relative_file_path TEXT,
    folder_major TEXT,
    folder_middle TEXT,
    folder_sub TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_audio_assets_source_group
        CHECK (source_group IN ('ambience', 'cinematic', 'dialogue_vo', 'foley', 'sfx', 'music'))
);

CREATE INDEX IF NOT EXISTS idx_audio_assets_source_group
    ON audio_assets(source_group);

CREATE INDEX IF NOT EXISTS idx_audio_assets_original_filename
    ON audio_assets(original_filename);

ALTER TABLE audio_assets
    ADD COLUMN IF NOT EXISTS s3_bucket TEXT;

ALTER TABLE audio_assets
    ADD COLUMN IF NOT EXISTS s3_key TEXT;

ALTER TABLE audio_assets
    ALTER COLUMN local_file_path DROP NOT NULL;

ALTER TABLE audio_assets
    DROP CONSTRAINT IF EXISTS ck_audio_assets_source_group;

ALTER TABLE audio_assets
    ADD CONSTRAINT ck_audio_assets_source_group
        CHECK (source_group IN ('ambience', 'cinematic', 'dialogue_vo', 'foley', 'sfx', 'music'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_audio_assets_s3_key
    ON audio_assets(s3_key)
    WHERE s3_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS audio_descriptions (
    id BIGSERIAL PRIMARY KEY,
    audio_asset_id BIGINT NOT NULL REFERENCES audio_assets(id) ON DELETE CASCADE,
    llm_source TEXT NOT NULL,
    run_name TEXT,
    primary_class TEXT,
    second_class TEXT,
    class_confidence DOUBLE PRECISION,
    short_caption_en TEXT NOT NULL,
    long_caption_en TEXT NOT NULL,
    tags_structured JSONB,
    raw_result_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audio_descriptions_audio_asset_id
    ON audio_descriptions(audio_asset_id);

CREATE INDEX IF NOT EXISTS idx_audio_descriptions_primary_class
    ON audio_descriptions(primary_class);

CREATE UNIQUE INDEX IF NOT EXISTS uq_audio_descriptions_source_run
    ON audio_descriptions(audio_asset_id, llm_source, run_name);

CREATE TABLE IF NOT EXISTS audio_embeddings (
    id BIGSERIAL PRIMARY KEY,
    audio_description_id BIGINT NOT NULL REFERENCES audio_descriptions(id) ON DELETE CASCADE,
    embedding_target TEXT NOT NULL,
    embedding_text TEXT NOT NULL,
    embedding_model TEXT NOT NULL,
    embedding_dim INTEGER NOT NULL,
    embedding vector(3072) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_audio_embeddings_target
        CHECK (embedding_target IN (
            'short_caption',
            'long_caption',
            'combined_caption'
        )),
    CONSTRAINT ck_audio_embeddings_dim
        CHECK (embedding_dim = 3072)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_audio_embeddings_unique_target
    ON audio_embeddings(audio_description_id, embedding_target, embedding_model);

CREATE INDEX IF NOT EXISTS idx_audio_embeddings_audio_description_id
    ON audio_embeddings(audio_description_id);

-- HNSW has a dimension limit for this pgvector setup.
-- With 3072-dim Gemini embeddings, keep the table index-free first and
-- add ANN tuning later if needed.

CREATE TABLE IF NOT EXISTS video_query_events (
    id BIGSERIAL PRIMARY KEY,
    project_key TEXT NOT NULL,
    source_json_path TEXT NOT NULL,
    video_context TEXT,
    track TEXT NOT NULL,
    category_path JSONB,
    tags JSONB,
    description TEXT NOT NULL,
    start_time DOUBLE PRECISION,
    end_time DOUBLE PRECISION,
    peak_time DOUBLE PRECISION,
    confidence DOUBLE PRECISION,
    raw_event_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_video_query_events_track
        CHECK (track IN ('ambience', 'music', 'cinematic', 'foley', 'sfx'))
);

CREATE INDEX IF NOT EXISTS idx_video_query_events_project_key
    ON video_query_events(project_key);

CREATE INDEX IF NOT EXISTS idx_video_query_events_track
    ON video_query_events(track);

CREATE TABLE IF NOT EXISTS video_query_embeddings (
    id BIGSERIAL PRIMARY KEY,
    video_query_event_id BIGINT NOT NULL REFERENCES video_query_events(id) ON DELETE CASCADE,
    embedding_target TEXT NOT NULL,
    embedding_text TEXT NOT NULL,
    embedding_model TEXT NOT NULL,
    embedding_dim INTEGER NOT NULL,
    embedding vector(3072) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_video_query_embeddings_target
        CHECK (embedding_target IN (
            'description',
            'description_with_context'
        )),
    CONSTRAINT ck_video_query_embeddings_dim
        CHECK (embedding_dim = 3072)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_video_query_embeddings_unique_target
    ON video_query_embeddings(video_query_event_id, embedding_target, embedding_model);

CREATE INDEX IF NOT EXISTS idx_video_query_embeddings_event_id
    ON video_query_embeddings(video_query_event_id);

-- HNSW index intentionally omitted here as well for the same 3072-dim reason.

CREATE TABLE IF NOT EXISTS retrieval_results (
    id BIGSERIAL PRIMARY KEY,
    video_query_event_id BIGINT NOT NULL REFERENCES video_query_events(id) ON DELETE CASCADE,
    audio_asset_id BIGINT NOT NULL REFERENCES audio_assets(id) ON DELETE CASCADE,
    audio_embedding_id BIGINT NOT NULL REFERENCES audio_embeddings(id) ON DELETE CASCADE,
    rank_order INTEGER NOT NULL,
    similarity DOUBLE PRECISION NOT NULL,
    track_match_score DOUBLE PRECISION,
    category_match_score DOUBLE PRECISION,
    tag_match_score DOUBLE PRECISION,
    final_score DOUBLE PRECISION NOT NULL,
    scoring_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retrieval_results_event_id
    ON retrieval_results(video_query_event_id);

CREATE INDEX IF NOT EXISTS idx_retrieval_results_audio_asset_id
    ON retrieval_results(audio_asset_id);

COMMIT;
