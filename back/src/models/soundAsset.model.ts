import { query } from "../config/db";
import { SoundAsset } from "./soundAsset.types";

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
};
