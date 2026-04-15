-- =============================================================
-- 003_ai_events.sql — AI 분석 이벤트 영속 테이블 + track_events.ai_event_id
--
-- 정책:
--   - ai_events 는 AI 파이프라인이 생성한 이벤트 의도(description + embedding)를
--     append-only 로 보관. 유저가 track_events 에서 삭제/이동/수정해도 여기는 그대로.
--   - track_events.ai_event_id 는 AI가 만든 클립에서 원 의도로의 역참조.
--     유저가 수동으로 추가한 클립은 NULL.
--   - saveProject 의 live-replace 전략과 충돌하지 않도록 track_events 에서는
--     ON DELETE SET NULL 이 아니라 단순 nullable FK. ai_events 가 지워지는
--     상황은 정책상 발생하지 않지만, 혹시 지워지더라도 track_event 는 살아남도록
--     ON DELETE SET NULL 로 안전망.
-- =============================================================

BEGIN;

-- ------------------------------------------------------------
-- ai_events
-- ------------------------------------------------------------
CREATE TABLE ai_events (
    id                    BIGSERIAL PRIMARY KEY,
    project_id            BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    group_type            track_group_type NOT NULL,
    description           TEXT NOT NULL,
    embedding             vector(3072) NOT NULL,
    suggested_start_time  REAL,
    suggested_end_time    REAL,
    analysis_batch        INT NOT NULL DEFAULT 1,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ai_events_project_id     ON ai_events(project_id);
CREATE INDEX idx_ai_events_project_batch  ON ai_events(project_id, analysis_batch);
-- embedding 3072차원은 ivfflat/hnsw 기본 한도 초과 — seq scan 수용, 추후 차원 축소 시 ANN 인덱스 추가

-- ------------------------------------------------------------
-- track_events.ai_event_id
-- ------------------------------------------------------------
ALTER TABLE track_events
    ADD COLUMN ai_event_id BIGINT REFERENCES ai_events(id) ON DELETE SET NULL;
CREATE INDEX idx_track_events_ai_event_id ON track_events(ai_event_id);

COMMIT;
