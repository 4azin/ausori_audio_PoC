import { query, Runner } from "../config/db";
import { ProjectSnapshot, SnapshotPayload } from "./projectSnapshot.types";

const COLUMNS = `
  id, project_id AS "projectId", version, snapshot,
  created_at AS "createdAt"
`;

export const projectSnapshotModel = {
  /** 특정 버전 조회 */
  async findByVersion(
    projectId: number,
    version: number,
  ): Promise<ProjectSnapshot | undefined> {
    const res = await query<ProjectSnapshot>(
      `SELECT ${COLUMNS} FROM project_snapshots
       WHERE project_id = $1 AND version = $2`,
      [projectId, version],
    );
    return res.rows[0];
  },

  /** 최신 버전 조회 */
  async findLatest(projectId: number): Promise<ProjectSnapshot | undefined> {
    const res = await query<ProjectSnapshot>(
      `SELECT ${COLUMNS} FROM project_snapshots
       WHERE project_id = $1
       ORDER BY version DESC
       LIMIT 1`,
      [projectId],
    );
    return res.rows[0];
  },

  /** 히스토리 목록 (snapshot JSON 제외) */
  async listByProjectId(
    projectId: number,
  ): Promise<Array<{ id: number; version: number; createdAt: Date }>> {
    const res = await query<{ id: number; version: number; createdAt: Date }>(
      `SELECT id, version, created_at AS "createdAt"
       FROM project_snapshots
       WHERE project_id = $1
       ORDER BY version DESC`,
      [projectId],
    );
    return res.rows;
  },

  /** 다음 version 번호 계산 */
  async nextVersion(projectId: number, runner?: Runner): Promise<number> {
    const sql = `SELECT COALESCE(MAX(version), 0) + 1 AS v
                 FROM project_snapshots WHERE project_id = $1`;
    const res = runner
      ? await runner.query(sql, [projectId])
      : await query(sql, [projectId]);
    return Number((res.rows[0] as { v: string | number }).v);
  },

  /** 스냅샷 생성 */
  async create(
    projectId: number,
    version: number,
    snapshot: SnapshotPayload,
    runner?: Runner,
  ): Promise<ProjectSnapshot> {
    const sql = `INSERT INTO project_snapshots (project_id, version, snapshot)
                 VALUES ($1, $2, $3::jsonb)
                 RETURNING ${COLUMNS}`;
    const params = [projectId, version, JSON.stringify(snapshot)];
    const res = runner
      ? await runner.query(sql, params)
      : await query(sql, params);
    return res.rows[0] as ProjectSnapshot;
  },
};
