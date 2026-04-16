-- =============================================================
-- 004_project_analyses.sql — AI 분석 리포트 원본 보관 + ai_events.analysis_id
--
-- 정책:
--   - project_analyses: AI JobDoneMessage 원본 페이로드를 append-only 로 보관.
--     한 번의 분석 완료 = 한 행. raw_payload(JSONB) 에 events[] 까지 통째.
--   - 자주 조회되는 video_summary / video_context / completed_at 는 별도 컬럼
--     으로 승격해 JSONB 파싱 비용 없이 목록/상세에서 활용.
--   - ai_events.analysis_id FK 추가 — 각 ai_event 가 어느 분석 회차에서 추출
--     되었는지 역추적 가능. analysis_batch 는 비정규화로 유지(필터 편의).
-- =============================================================

BEGIN;

-- ------------------------------------------------------------
-- project_analyses
-- ------------------------------------------------------------
CREATE TABLE project_analyses (
    id              BIGSERIAL PRIMARY KEY,
    project_id      BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    job_id          VARCHAR(64) NOT NULL,
    analysis_batch  INT NOT NULL,
    video_summary   TEXT,
    video_context   TEXT,
    raw_payload     JSONB NOT NULL,
    telemetry       JSONB,
    completed_at    TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, analysis_batch)
);
CREATE INDEX idx_project_analyses_project_id ON project_analyses(project_id);
CREATE INDEX idx_project_analyses_job_id     ON project_analyses(job_id);

-- ------------------------------------------------------------
-- ai_events.analysis_id
-- ------------------------------------------------------------
ALTER TABLE ai_events
    ADD COLUMN analysis_id BIGINT REFERENCES project_analyses(id) ON DELETE CASCADE;
CREATE INDEX idx_ai_events_analysis_id ON ai_events(analysis_id);

-- 신규 INSERT 부터 analysis_id 채워짐. 기존 데이터는 nullable 인 채로 둠.
-- (개발 단계라 historic 데이터 없음)

COMMIT;
