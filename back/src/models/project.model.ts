import { query, Runner } from "../config/db";
import { Project } from "./project.types";

const PROJECT_COLUMNS = `
  id, user_id AS "userId", title, thumbnail_url AS "thumbnailUrl",
  status, original_video_url AS "originalVideoUrl",
  duration_seconds AS "durationSeconds",
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

/** Project DB 접근 레이어 */
export const projectModel = {
  async findAllByUserId(
    userId: number,
    opts: { limit: number; offset: number } = { limit: 10, offset: 0 },
  ): Promise<{ rows: Project[]; total: number }> {
    const list = await query<Project>(
      `SELECT ${PROJECT_COLUMNS} FROM projects
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, opts.limit, opts.offset],
    );
    const count = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM projects WHERE user_id = $1`,
      [userId],
    );
    return { rows: list.rows, total: Number(count.rows[0]?.count ?? 0) };
  },

  async findById(id: number): Promise<Project | undefined> {
    const res = await query<Project>(
      `SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = $1`,
      [id],
    );
    return res.rows[0];
  },

  async create(data: { userId: number; title: string }): Promise<Project> {
    const res = await query<Project>(
      `INSERT INTO projects (user_id, title)
       VALUES ($1, $2)
       RETURNING ${PROJECT_COLUMNS}`,
      [data.userId, data.title],
    );
    return res.rows[0];
  },

  async update(
    id: number,
    data: Partial<{ title: string; status: Project["status"]; thumbnailUrl: string; originalVideoUrl: string; durationSeconds: number }>,
    runner?: Runner,
  ): Promise<Project | undefined> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (data.title !== undefined) { sets.push(`title = $${i++}`); params.push(data.title); }
    if (data.status !== undefined) { sets.push(`status = $${i++}`); params.push(data.status); }
    if (data.thumbnailUrl !== undefined) { sets.push(`thumbnail_url = $${i++}`); params.push(data.thumbnailUrl); }
    if (data.originalVideoUrl !== undefined) { sets.push(`original_video_url = $${i++}`); params.push(data.originalVideoUrl); }
    if (data.durationSeconds !== undefined) { sets.push(`duration_seconds = $${i++}`); params.push(data.durationSeconds); }

    if (sets.length === 0) return this.findById(id);

    params.push(id);
    const sql = `UPDATE projects SET ${sets.join(", ")} WHERE id = $${i}
                 RETURNING ${PROJECT_COLUMNS}`;

    const res = runner
      ? await runner.query(sql, params)
      : await query(sql, params);
    return res.rows[0] as Project | undefined;
  },

  async delete(id: number): Promise<boolean> {
    const res = await query(`DELETE FROM projects WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  },

  /** 당월 생성한 프로젝트 개수 (무료 플랜 제한 체크용) */
  async countThisMonth(userId: number): Promise<number> {
    const res = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM projects
       WHERE user_id = $1
         AND created_at >= date_trunc('month', NOW())`,
      [userId],
    );
    return Number(res.rows[0]?.count ?? 0);
  },
};
