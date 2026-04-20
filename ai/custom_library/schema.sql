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

COMMIT;

