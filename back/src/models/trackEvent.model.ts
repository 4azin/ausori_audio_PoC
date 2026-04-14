import { query, Runner } from "../config/db";
import { TrackEvent } from "./trackEvent.types";

const COLUMNS = `
  id, project_id AS "projectId", track_id AS "trackId",
  sound_asset_id AS "soundAssetId",
  start_time AS "startTime", end_time AS "endTime", "offset",
  volume_override AS "volumeOverride",
  fade_in AS "fadeIn", fade_out AS "fadeOut",
  is_user_edited AS "isUserEdited",
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

export const trackEventModel = {
  async findAllByProjectId(projectId: number): Promise<TrackEvent[]> {
    const res = await query<TrackEvent>(
      `SELECT ${COLUMNS} FROM track_events
       WHERE project_id = $1
       ORDER BY track_id ASC, start_time ASC, id ASC`,
      [projectId],
    );
    return res.rows;
  },

  async deleteAllByProjectId(projectId: number, runner?: Runner): Promise<void> {
    const sql = `DELETE FROM track_events WHERE project_id = $1`;
    if (runner) await runner.query(sql, [projectId]);
    else await query(sql, [projectId]);
  },

  async createMany(
    projectId: number,
    data: Omit<TrackEvent, "id" | "projectId" | "createdAt" | "updatedAt">[],
    runner?: Runner,
  ): Promise<TrackEvent[]> {
    if (data.length === 0) return [];

    const values: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    for (const e of data) {
      values.push(
        `($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`,
      );
      params.push(
        projectId, e.trackId, e.soundAssetId,
        e.startTime, e.endTime, e.offset,
        e.volumeOverride, e.fadeIn, e.fadeOut, e.isUserEdited,
      );
    }

    const sql = `INSERT INTO track_events
                   (project_id, track_id, sound_asset_id,
                    start_time, end_time, "offset",
                    volume_override, fade_in, fade_out, is_user_edited)
                 VALUES ${values.join(", ")}
                 RETURNING ${COLUMNS}`;

    const res = runner ? await runner.query(sql, params) : await query(sql, params);
    return res.rows as TrackEvent[];
  },
};
