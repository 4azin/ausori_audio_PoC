import { query, Runner } from "../config/db";
import { TrackGroup } from "./trackGroup.types";

const COLUMNS = `
  id, project_id AS "projectId", type, volume,
  is_muted AS "isMuted", is_solo AS "isSolo", "order",
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

export const trackGroupModel = {
  async findAllByProjectId(projectId: number): Promise<TrackGroup[]> {
    const res = await query<TrackGroup>(
      `SELECT ${COLUMNS} FROM track_groups
       WHERE project_id = $1
       ORDER BY "order" ASC, id ASC`,
      [projectId],
    );
    return res.rows;
  },

  async deleteAllByProjectId(projectId: number, runner?: Runner): Promise<void> {
    const sql = `DELETE FROM track_groups WHERE project_id = $1`;
    if (runner) await runner.query(sql, [projectId]);
    else await query(sql, [projectId]);
  },

  async createMany(
    projectId: number,
    data: Omit<TrackGroup, "id" | "projectId" | "createdAt" | "updatedAt">[],
    runner?: Runner,
  ): Promise<TrackGroup[]> {
    if (data.length === 0) return [];

    const values: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    for (const g of data) {
      values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
      params.push(projectId, g.type, g.volume, g.isMuted, g.isSolo, g.order);
    }

    const sql = `INSERT INTO track_groups (project_id, type, volume, is_muted, is_solo, "order")
                 VALUES ${values.join(", ")}
                 RETURNING ${COLUMNS}`;

    const res = runner ? await runner.query(sql, params) : await query(sql, params);
    return res.rows as TrackGroup[];
  },
};
