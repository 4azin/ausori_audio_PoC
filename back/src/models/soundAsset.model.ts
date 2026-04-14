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
   * 카테고리 필터 + 코사인 유사도 top-k.
   * TODO: pgvector 쿼리 문자열 포맷 (`[0.1,0.2,...]`) 변환 헬퍼 필요.
   */
  async vectorSearch(
    _filter: VectorSearchFilter,
    _queryVec: number[],
    _k = 1,
  ): Promise<VectorSearchHit[]> {
    throw new Error("[soundAsset.vectorSearch] not implemented");
  },
};
