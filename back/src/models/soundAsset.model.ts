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

export interface SimilarSoundHit {
  id: number;
  fileName: string;
  category: { major: string; mid: string; sub: string };
  mood: string[];
  tags: string[];
  duration: number;
  format: string;
  similarity: number;
}

export interface SimilarSearchFilter {
  level: "major" | "mid" | "sub";
  majorId?: number;
  midId?: number;
  subId?: number;
  excludeId?: number;
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

  /** 에셋의 카테고리 ID 조회 (level 기본값 결정용) */
  async findCategoryById(
    id: number,
  ): Promise<{ majorId: number; midId: number; subId: number } | null> {
    const res = await query<{ majorId: number; midId: number; subId: number }>(
      `SELECT major_id AS "majorId", mid_id AS "midId", sub_id AS "subId"
       FROM sound_assets WHERE id = $1`,
      [id],
    );
    return res.rows[0] ?? null;
  },

  /** 에셋의 임베딩 벡터 조회 */
  async findEmbeddingById(id: number): Promise<number[] | null> {
    const res = await query<{ embedding: string }>(
      `SELECT embedding::text AS embedding FROM sound_assets WHERE id = $1`,
      [id],
    );
    if (res.rows.length === 0) return null;
    const raw = res.rows[0].embedding;
    if (!raw) return null;
    return raw.slice(1, -1).split(",").map(Number);
  },

  /**
   * 유사 에셋 검색 — 카테고리 필터(level 기반) + 코사인 유사도.
   * category 이름을 JOIN으로 함께 반환.
   */
  async similarSearch(
    filter: SimilarSearchFilter,
    queryVec: number[],
    limit = 100,
    offset = 0,
  ): Promise<SimilarSoundHit[]> {
    if (queryVec.length === 0) return [];
    const literal = "[" + queryVec.join(",") + "]";

    const params: unknown[] = [literal];
    const conditions: string[] = [];

    if (filter.majorId != null) {
      params.push(filter.majorId);
      conditions.push(`sa.major_id = $${params.length}`);
    }
    if (filter.level !== "major" && filter.midId != null) {
      params.push(filter.midId);
      conditions.push(`sa.mid_id = $${params.length}`);
    }
    if (filter.level === "sub" && filter.subId != null) {
      params.push(filter.subId);
      conditions.push(`sa.sub_id = $${params.length}`);
    }
    if (filter.excludeId != null) {
      params.push(filter.excludeId);
      conditions.push(`sa.id != $${params.length}`);
    }

    params.push(limit, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT sa.id,
             sa.file_name AS "fileName",
             sa.mood, sa.tags,
             sa.duration::real AS duration,
             sa.format::text AS format,
             cm.name  AS "majorName",
             cmi.name AS "midName",
             cs.name  AS "subName",
             (1 - (sa.embedding <=> $1::vector))::real AS similarity
      FROM sound_assets sa
      JOIN category_major cm  ON cm.id  = sa.major_id
      JOIN category_mid   cmi ON cmi.id = sa.mid_id
      JOIN category_sub   cs  ON cs.id  = sa.sub_id
      ${where}
      ORDER BY sa.embedding <=> $1::vector
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    interface RawRow {
      id: number;
      fileName: string;
      mood: string[];
      tags: string[];
      duration: number;
      format: string;
      majorName: string;
      midName: string;
      subName: string;
      similarity: number;
    }

    const res = await query<RawRow>(sql, params);
    return res.rows.map((r) => ({
      id: r.id,
      fileName: r.fileName,
      category: { major: r.majorName, mid: r.midName, sub: r.subName },
      mood: r.mood,
      tags: r.tags,
      duration: r.duration,
      format: r.format,
      similarity: r.similarity,
    }));
  },
};
