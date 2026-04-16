import { query } from "../config/db";
import { SoundAsset, SoundAssetFull } from "./soundAsset.types";

const PLAYBACK_COLUMNS = `
  id, file_name AS "fileName", s3_key AS "s3Key",
  duration, format, channels,
  sample_rate AS "sampleRate", file_size AS "fileSize"
`;

export interface VectorSearchFilter {
  majorId: number;
  midId: number;
  subId?: number;
}

export interface VectorSearchHit {
  id: number;
  duration: number;
  similarity: number;
}

const FULL_COLUMNS = `
  id, designer_id AS "designerId", file_name AS "fileName", s3_key AS "s3Key",
  original_path AS "originalPath",
  major_id AS "majorId", mid_id AS "midId", sub_id AS "subId",
  mood, tags, description, bpm, instruments,
  duration, format, channels, sample_rate AS "sampleRate",
  file_size AS "fileSize", download_count AS "downloadCount",
  created_at AS "createdAt"
`;

export const soundAssetModel = {
  /** id 목록으로 재생용 메타 일괄 조회 (loadProject의 soundAssets 맵 구성용) */
  async findPlaybackByIds(ids: number[]): Promise<SoundAsset[]> {
    if (ids.length === 0) return [];
    const res = await query<SoundAsset>(
      `SELECT ${PLAYBACK_COLUMNS} FROM sound_assets WHERE id = ANY($1::bigint[])`,
      [ids],
    );
    return res.rows;
  },

  /**
   * 카테고리 필터(필수: major+mid, 선택: sub) + 코사인 유사도 top-k.
   * pgvector `<=>` 연산자 = cosine_distance. similarity = 1 - distance.
   * 3072 차원이라 ANN 인덱스 없이 seq scan — 7K 행 기준 수십~수백 ms.
   */
  async vectorSearch(
    filter: VectorSearchFilter,
    queryVec: number[],
    k = 1,
  ): Promise<VectorSearchHit[]> {
    if (queryVec.length === 0) return [];
    const literal = "[" + queryVec.join(",") + "]";

    const params: unknown[] = [literal, filter.majorId, filter.midId];
    let where = `major_id = $2 AND mid_id = $3`;
    if (filter.subId != null) {
      params.push(filter.subId);
      where += ` AND sub_id = $${params.length}`;
    }
    params.push(k);
    const limitIdx = params.length;

    const sql = `
      SELECT id, duration::real AS duration,
             (1 - (embedding <=> $1::vector))::real AS similarity
      FROM sound_assets
      WHERE ${where}
      ORDER BY embedding <=> $1::vector
      LIMIT $${limitIdx}
    `;

    const res = await query<VectorSearchHit>(sql, params);
    return res.rows;
  },

  async findById(id: number): Promise<SoundAssetFull | undefined> {
    const res = await query<SoundAssetFull>(
      `SELECT ${FULL_COLUMNS} FROM sound_assets WHERE id = $1`,
      [id],
    );
    return res.rows[0];
  },

  async findAllByDesignerId(
    designerId: number,
    opts: { limit: number; offset: number } = { limit: 20, offset: 0 },
  ): Promise<{ rows: SoundAssetFull[]; total: number }> {
    const list = await query<SoundAssetFull>(
      `SELECT ${FULL_COLUMNS} FROM sound_assets
       WHERE designer_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [designerId, opts.limit, opts.offset],
    );
    const count = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM sound_assets WHERE designer_id = $1`,
      [designerId],
    );
    return { rows: list.rows, total: Number(count.rows[0]?.count ?? 0) };
  },

  async create(data: {
    designerId: number;
    fileName: string;
    s3Key: string;
    originalPath?: string;
    majorId: number;
    midId: number;
    subId: number;
    mood: string[];
    tags: string[];
    description?: string;
    bpm?: number;
    instruments?: string[];
    duration: number;
    format: string;
    channels: number;
    sampleRate: number;
    fileSize: number;
  }): Promise<SoundAssetFull> {
    const res = await query<SoundAssetFull>(
      `INSERT INTO sound_assets (
        designer_id, file_name, s3_key, original_path,
        major_id, mid_id, sub_id,
        mood, tags, description, bpm, instruments,
        duration, format, channels, sample_rate, file_size
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING ${FULL_COLUMNS}`,
      [
        data.designerId, data.fileName, data.s3Key, data.originalPath ?? null,
        data.majorId, data.midId, data.subId,
        data.mood, data.tags, data.description ?? null, data.bpm ?? null, data.instruments ?? null,
        data.duration, data.format, data.channels, data.sampleRate, data.fileSize,
      ],
    );
    return res.rows[0];
  },

  async updateById(
    id: number,
    data: Partial<{ tags: string[]; description: string; mood: string[] }>,
  ): Promise<{ id: number } | undefined> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (data.tags !== undefined) { sets.push(`tags = $${i++}`); params.push(data.tags); }
    if (data.description !== undefined) { sets.push(`description = $${i++}`); params.push(data.description); }
    if (data.mood !== undefined) { sets.push(`mood = $${i++}`); params.push(data.mood); }

    if (sets.length === 0) return { id };

    params.push(id);
    const res = await query<{ id: number }>(
      `UPDATE sound_assets SET ${sets.join(", ")} WHERE id = $${i}
       RETURNING id`,
      params,
    );
    return res.rows[0];
  },

  async deleteById(id: number): Promise<boolean> {
    const res = await query(`DELETE FROM sound_assets WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  },
};
