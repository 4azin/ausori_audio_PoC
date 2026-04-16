import { query, Runner } from "../config/db";
import { AiEvent } from "./aiEvent.types";

/** pgvector 텍스트 리터럴 포맷: [v1,v2,...] */
function toVectorLiteral(vec: number[]): string {
  return "[" + vec.join(",") + "]";
}

/**
 * 기본 SELECT — embedding 은 12KB/행이라 lookup/list 쿼리에선 제외.
 * embedding 이 필요한 경우 findEmbeddingById 사용.
 */
const BASE_COLUMNS = `
  id, project_id AS "projectId",
  analysis_id AS "analysisId",
  group_type AS "groupType",
  description,
  suggested_start_time AS "suggestedStartTime",
  suggested_end_time AS "suggestedEndTime",
  analysis_batch AS "analysisBatch",
  created_at AS "createdAt"
`;

type CreateInput = Omit<
  AiEvent,
  "id" | "projectId" | "analysisId" | "analysisBatch" | "createdAt" | "embedding"
> & {
  embedding: number[]; // INSERT 시점에는 필수
};

export const aiEventModel = {
  async findById(id: number): Promise<AiEvent | null> {
    const res = await query<AiEvent>(
      `SELECT ${BASE_COLUMNS} FROM ai_events WHERE id = $1`,
      [id],
    );
    return res.rows[0] ?? null;
  },

  async findAllByProjectId(projectId: number): Promise<AiEvent[]> {
    const res = await query<AiEvent>(
      `SELECT ${BASE_COLUMNS} FROM ai_events
       WHERE project_id = $1
       ORDER BY analysis_batch DESC, id ASC`,
      [projectId],
    );
    return res.rows;
  },

  async nextBatch(projectId: number, runner?: Runner): Promise<number> {
    const sql = `SELECT COALESCE(MAX(analysis_batch), 0) + 1 AS batch
                 FROM ai_events WHERE project_id = $1`;
    const res = runner ? await runner.query(sql, [projectId]) : await query(sql, [projectId]);
    return Number((res.rows[0] as { batch: number }).batch);
  },

  /** AI 파이프라인 결과 반영 — append-only. 반환 배열은 입력 순서 유지 */
  async createMany(
    projectId: number,
    analysisId: number,
    batch: number,
    data: CreateInput[],
    runner?: Runner,
  ): Promise<AiEvent[]> {
    if (data.length === 0) return [];

    const values: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    for (const e of data) {
      values.push(
        `($${i++}, $${i++}, $${i++}, $${i++}, $${i++}::vector, $${i++}, $${i++}, $${i++})`,
      );
      params.push(
        projectId,
        analysisId,
        e.groupType,
        e.description,
        toVectorLiteral(e.embedding),
        e.suggestedStartTime,
        e.suggestedEndTime,
        batch,
      );
    }

    const sql = `INSERT INTO ai_events
                   (project_id, analysis_id, group_type, description, embedding,
                    suggested_start_time, suggested_end_time, analysis_batch)
                 VALUES ${values.join(", ")}
                 RETURNING ${BASE_COLUMNS}`;

    const res = runner ? await runner.query(sql, params) : await query(sql, params);
    return res.rows as AiEvent[];
  },

  /** 원 description embedding 조회 — /similar 에서 사용 */
  async findEmbeddingById(id: number): Promise<number[] | null> {
    const res = await query<{ embedding: string }>(
      `SELECT embedding::text AS embedding FROM ai_events WHERE id = $1`,
      [id],
    );
    if (res.rows.length === 0) return null;
    // "[0.1,0.2,...]" → number[]
    const raw = res.rows[0].embedding;
    return raw
      .slice(1, -1)
      .split(",")
      .map((s) => Number(s));
  },
};
