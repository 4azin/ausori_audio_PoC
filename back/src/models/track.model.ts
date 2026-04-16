import { query, Runner } from "../config/db";
import { Track } from "./track.types";

const COLUMNS = `
  id, project_id AS "projectId", group_id AS "groupId",
  name, volume, pan, is_muted AS "isMuted", is_solo AS "isSolo", "order",
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

export const trackModel = {
  async findAllByProjectId(projectId: number): Promise<Track[]> {
    const res = await query<Track>(
      `SELECT ${COLUMNS} FROM tracks
       WHERE project_id = $1
       ORDER BY group_id ASC, "order" ASC, id ASC`,
      [projectId],
    );
    return res.rows;
  },

  async deleteAllByProjectId(projectId: number, runner?: Runner): Promise<void> {
    const sql = `DELETE FROM tracks WHERE project_id = $1`;
    if (runner) await runner.query(sql, [projectId]);
    else await query(sql, [projectId]);
  },

  async createMany(
    projectId: number,
    data: Omit<Track, "id" | "projectId" | "createdAt" | "updatedAt">[],
    runner?: Runner,
  ): Promise<Track[]> {
    if (data.length === 0) return [];

    const values: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    for (const t of data) {
      values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
      params.push(projectId, t.groupId, t.name, t.volume, t.pan, t.isMuted, t.isSolo, t.order);
    }

    const sql = `INSERT INTO tracks (project_id, group_id, name, volume, pan, is_muted, is_solo, "order")
                 VALUES ${values.join(", ")}
                 RETURNING ${COLUMNS}`;

    const res = runner ? await runner.query(sql, params) : await query(sql, params);
    return res.rows as Track[];
  },
};
