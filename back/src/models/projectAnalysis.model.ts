import { query, Runner } from "../config/db";
import { ProjectAnalysis, ProjectAnalysisSummary } from "./projectAnalysis.types";

const COLUMNS = `
  id, project_id AS "projectId", job_id AS "jobId",
  analysis_batch AS "analysisBatch",
  video_summary AS "videoSummary", video_context AS "videoContext",
  raw_payload AS "rawPayload", telemetry,
  completed_at AS "completedAt", created_at AS "createdAt"
`;

const SUMMARY_SQL = `
  SELECT pa.id,
         pa.job_id          AS "jobId",
         pa.analysis_batch  AS "analysisBatch",
         pa.video_summary   AS "videoSummary",
         pa.video_context   AS "videoContext",
         COALESCE(ec.cnt, 0)::int AS "eventCount",
         pa.completed_at    AS "completedAt",
         pa.created_at      AS "createdAt"
  FROM project_analyses pa
  LEFT JOIN (
    SELECT analysis_id, COUNT(*)::int AS cnt
    FROM ai_events
    WHERE analysis_id IS NOT NULL
    GROUP BY analysis_id
  ) ec ON ec.analysis_id = pa.id
`;

interface CreateInput {
  jobId: string;
  analysisBatch: number;
  videoSummary: string | null;
  videoContext: string | null;
  rawPayload: unknown;
  telemetry: unknown | null;
  completedAt: Date | string;
}

export const projectAnalysisModel = {
  async create(
    projectId: number,
    data: CreateInput,
    runner?: Runner,
  ): Promise<ProjectAnalysis> {
    const sql = `INSERT INTO project_analyses
                   (project_id, job_id, analysis_batch,
                    video_summary, video_context,
                    raw_payload, telemetry, completed_at)
                 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
                 RETURNING ${COLUMNS}`;
    const params = [
      projectId,
      data.jobId,
      data.analysisBatch,
      data.videoSummary,
      data.videoContext,
      JSON.stringify(data.rawPayload),
      data.telemetry == null ? null : JSON.stringify(data.telemetry),
      data.completedAt,
    ];
    const res = runner ? await runner.query(sql, params) : await query(sql, params);
    return res.rows[0] as ProjectAnalysis;
  },

  async nextBatch(projectId: number, runner?: Runner): Promise<number> {
    const sql = `SELECT COALESCE(MAX(analysis_batch), 0) + 1 AS batch
                 FROM project_analyses WHERE project_id = $1`;
    const res = runner ? await runner.query(sql, [projectId]) : await query(sql, [projectId]);
    return Number((res.rows[0] as { batch: number }).batch);
  },

  async findById(id: number): Promise<ProjectAnalysis | null> {
    const res = await query<ProjectAnalysis>(
      `SELECT ${COLUMNS} FROM project_analyses WHERE id = $1`,
      [id],
    );
    return res.rows[0] ?? null;
  },

  async findByBatch(projectId: number, batch: number): Promise<ProjectAnalysis | null> {
    const res = await query<ProjectAnalysis>(
      `SELECT ${COLUMNS} FROM project_analyses
       WHERE project_id = $1 AND analysis_batch = $2`,
      [projectId, batch],
    );
    return res.rows[0] ?? null;
  },

  async findLatest(projectId: number): Promise<ProjectAnalysis | null> {
    const res = await query<ProjectAnalysis>(
      `SELECT ${COLUMNS} FROM project_analyses
       WHERE project_id = $1
       ORDER BY analysis_batch DESC LIMIT 1`,
      [projectId],
    );
    return res.rows[0] ?? null;
  },

  async listSummaries(projectId: number): Promise<ProjectAnalysisSummary[]> {
    const res = await query<ProjectAnalysisSummary>(
      `${SUMMARY_SQL}
       WHERE pa.project_id = $1
       ORDER BY pa.analysis_batch DESC`,
      [projectId],
    );
    return res.rows;
  },
};
