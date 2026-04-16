import { query } from "../config/db";
import { SoundAsset, SoundAssetFull } from "./soundAsset.types";

const PLAYBACK_COLUMNS = `
  id, file_name AS "fileName", s3_key AS "s3Key",
  duration, format, channels,
  sample_rate AS "sampleRate", file_size AS "fileSize"
`;

const FULL_COLUMNS = `
  id, designer_id AS "designerId", file_name AS "fileName", s3_key AS "s3Key",
  original_path AS "originalPath",
  major_id AS "majorId", mid_id AS "midId", sub_id AS "subId",
  mood, tags, description, bpm, instruments,
  duration, format, channels, sample_rate AS "sampleRate",
  file_size AS "fileSize", download_count AS "downloadCount",
  created_at AS "createdAt"
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

  /** 디자이너 CRUD — 단건 상세 조회 */
  async findById(id: number): Promise<SoundAssetFull | undefined> {
    const res = await query<SoundAssetFull>(
      `SELECT ${FULL_COLUMNS} FROM sound_assets WHERE id = $1`,
      [id],
    );
    return res.rows[0];
  },

  /** 디자이너 CRUD — 본인 업로드 목록 */
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

  /** 디자이너 CRUD — 신규 업로드 */
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

  /** 디자이너 CRUD — 메타데이터 업데이트 */
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

  /** 디자이너 CRUD — 삭제 */
  async deleteById(id: number): Promise<boolean> {
    const res = await query(`DELETE FROM sound_assets WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  },
};
