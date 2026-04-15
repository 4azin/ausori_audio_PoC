-- =============================================================
-- 001_init.sql — 초기 스키마 생성
-- ERD: back/03_erd.md 기준
-- =============================================================

BEGIN;

-- ------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- ------------------------------------------------------------
-- ENUM types
-- ------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('user', 'designer', 'admin');
CREATE TYPE user_plan AS ENUM ('free', 'pro');
CREATE TYPE project_status AS ENUM ('uploading', 'analyzing', 'ready', 'failed');
CREATE TYPE track_group_type AS ENUM (
    'ambience', 'cinematic', 'dialogue_vo', 'foley', 'sfx', 'music'
);
CREATE TYPE sound_format AS ENUM ('mp3', 'ogg', 'wav', 'aif');

-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------
CREATE TABLE users (
    id                   BIGSERIAL PRIMARY KEY,
    email                VARCHAR(255) NOT NULL UNIQUE,
    name                 VARCHAR(100) NOT NULL,
    profile_image_url    VARCHAR(500),
    google_id            VARCHAR(100) NOT NULL UNIQUE,
    role                 user_role NOT NULL DEFAULT 'user',
    plan                 user_plan NOT NULL DEFAULT 'free',
    monthly_usage_count  INT NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- sound_designers
-- ------------------------------------------------------------
CREATE TABLE sound_designers (
    id                   BIGSERIAL PRIMARY KEY,
    user_id              BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    display_name         VARCHAR(100) NOT NULL,
    bio                  TEXT,
    revenue_share_rate   REAL NOT NULL DEFAULT 0.7,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- projects
-- ------------------------------------------------------------
CREATE TABLE projects (
    id                   BIGSERIAL PRIMARY KEY,
    user_id              BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title                VARCHAR(200) NOT NULL,
    thumbnail_url        VARCHAR(500),
    status               project_status NOT NULL DEFAULT 'uploading',
    original_video_url   VARCHAR(500),
    duration_seconds     INT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_projects_user_id ON projects(user_id);

-- ------------------------------------------------------------
-- track_groups
-- ------------------------------------------------------------
CREATE TABLE track_groups (
    id          BIGSERIAL PRIMARY KEY,
    project_id  BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type        track_group_type NOT NULL,
    volume      INT NOT NULL DEFAULT 100 CHECK (volume BETWEEN 0 AND 100),
    is_muted    BOOLEAN NOT NULL DEFAULT FALSE,
    is_solo     BOOLEAN NOT NULL DEFAULT FALSE,
    "order"     INT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_track_groups_project_id ON track_groups(project_id);

-- ------------------------------------------------------------
-- tracks
-- ------------------------------------------------------------
CREATE TABLE tracks (
    id          BIGSERIAL PRIMARY KEY,
    project_id  BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,  -- 비정규화
    group_id    BIGINT NOT NULL REFERENCES track_groups(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    volume      INT NOT NULL DEFAULT 100 CHECK (volume BETWEEN 0 AND 100),
    pan         INT NOT NULL DEFAULT 0 CHECK (pan BETWEEN -100 AND 100),
    is_muted    BOOLEAN NOT NULL DEFAULT FALSE,
    is_solo     BOOLEAN NOT NULL DEFAULT FALSE,
    "order"     INT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tracks_project_id ON tracks(project_id);
CREATE INDEX idx_tracks_group_id ON tracks(group_id);

-- ------------------------------------------------------------
-- category_major / category_mid / category_sub
-- ------------------------------------------------------------
CREATE TABLE category_major (
    id    BIGSERIAL PRIMARY KEY,
    name  VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE category_mid (
    id        BIGSERIAL PRIMARY KEY,
    major_id  BIGINT NOT NULL REFERENCES category_major(id) ON DELETE CASCADE,
    name      VARCHAR(50) NOT NULL,
    UNIQUE (major_id, name)
);

-- category_sub: sub는 mid에 종속되지 않는 flat 라벨 풀
-- (같은 이름이 여러 sub_id로 존재 가능 — 예: Metal/Wood/Dark 등 맥락별 변형)
CREATE TABLE category_sub (
    id    BIGSERIAL PRIMARY KEY,
    name  VARCHAR(50) NOT NULL
);
CREATE INDEX idx_category_sub_name ON category_sub(name);

-- ------------------------------------------------------------
-- sound_assets
-- ------------------------------------------------------------
CREATE TABLE sound_assets (
    id              BIGSERIAL PRIMARY KEY,
    designer_id     BIGINT REFERENCES sound_designers(id) ON DELETE SET NULL,
    file_name       VARCHAR(255) NOT NULL,
    s3_key          VARCHAR(500) NOT NULL UNIQUE,
    original_path   VARCHAR(500),
    major_id        BIGINT NOT NULL REFERENCES category_major(id) ON DELETE RESTRICT,
    mid_id          BIGINT NOT NULL REFERENCES category_mid(id) ON DELETE RESTRICT,
    sub_id          BIGINT NOT NULL REFERENCES category_sub(id) ON DELETE RESTRICT,
    mood            TEXT[] NOT NULL DEFAULT '{}',
    tags            TEXT[] NOT NULL DEFAULT '{}',
    description     TEXT,
    bpm             INT,
    instruments     TEXT[],
    duration        REAL NOT NULL,
    format          sound_format NOT NULL,
    channels        INT NOT NULL CHECK (channels > 0),
    sample_rate     INT NOT NULL,
    file_size       INT NOT NULL,
    download_count  INT NOT NULL DEFAULT 0,
    embedding       vector(3072),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sound_assets_major_id ON sound_assets(major_id);
CREATE INDEX idx_sound_assets_mid_id ON sound_assets(mid_id);
CREATE INDEX idx_sound_assets_sub_id ON sound_assets(sub_id);
CREATE INDEX idx_sound_assets_designer_id ON sound_assets(designer_id);
CREATE INDEX idx_sound_assets_tags ON sound_assets USING GIN (tags);
CREATE INDEX idx_sound_assets_mood ON sound_assets USING GIN (mood);
-- embedding 인덱스: 3072차원은 ivfflat/hnsw 기본 제약 초과 — 차원 축소 후 별도 ANN 인덱스 추가 예정

-- ------------------------------------------------------------
-- track_events
-- ------------------------------------------------------------
CREATE TABLE track_events (
    id               BIGSERIAL PRIMARY KEY,
    project_id       BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,  -- 비정규화
    track_id         BIGINT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    sound_asset_id   BIGINT NOT NULL REFERENCES sound_assets(id) ON DELETE RESTRICT,
    start_time       REAL NOT NULL,
    end_time         REAL NOT NULL,
    "offset"         REAL NOT NULL DEFAULT 0,
    volume_override  INT NOT NULL DEFAULT 100 CHECK (volume_override BETWEEN 0 AND 100),
    fade_in          REAL NOT NULL DEFAULT 0,
    fade_out         REAL NOT NULL DEFAULT 0,
    is_user_edited   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_track_events_project_id ON track_events(project_id);
CREATE INDEX idx_track_events_track_id ON track_events(track_id);

-- ------------------------------------------------------------
-- project_snapshots
-- ------------------------------------------------------------
CREATE TABLE project_snapshots (
    id          BIGSERIAL PRIMARY KEY,
    project_id  BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version     INT NOT NULL,
    snapshot    JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, version)
);
CREATE INDEX idx_project_snapshots_project_id ON project_snapshots(project_id);

-- ------------------------------------------------------------
-- updated_at 자동 갱신 트리거
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at         BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_projects_updated_at      BEFORE UPDATE ON projects      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_track_groups_updated_at  BEFORE UPDATE ON track_groups  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tracks_updated_at        BEFORE UPDATE ON tracks        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_track_events_updated_at  BEFORE UPDATE ON track_events  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
