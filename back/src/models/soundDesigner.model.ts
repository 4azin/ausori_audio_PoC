import { query } from "../config/db";
import { SoundDesigner } from "./soundDesigner.types";

/**
 * SELECT할 컬럼 목록 — DB의 snake_case를 TypeScript의 camelCase로 변환
 *
 * SQL의 AS "camelCase" 문법:
 *   user_id AS "userId"  →  DB에서는 user_id, JS에서는 userId로 접근
 *   큰따옴표 필수 — 없으면 PostgreSQL이 소문자로 변환해버림
 */
const COLUMNS = `
  id, user_id AS "userId", display_name AS "displayName",
  bio, revenue_share_rate AS "revenueShareRate",
  created_at AS "createdAt"
`;

/**
 * SoundDesigner DB 접근 레이어
 *
 * query<T>(sql, params): db.ts에서 export한 함수
 *   - T: 결과 row의 타입
 *   - $1, $2: SQL injection 방지용 파라미터 바인딩
 *     예: WHERE user_id = $1  +  params: [123]
 *     → WHERE user_id = 123 (안전하게 이스케이프됨)
 */
export const soundDesignerModel = {
  /** userId로 디자이너 조회 — users 테이블의 id로 검색 */
  async findByUserId(userId: number): Promise<SoundDesigner | undefined> {
    const res = await query<SoundDesigner>(
      `SELECT ${COLUMNS} FROM sound_designers WHERE user_id = $1`,
      [userId],
    );
    // rows[0]이 undefined면 해당 유저는 디자이너가 아님
    return res.rows[0];
  },

  /** 디자이너 생성 — RETURNING으로 INSERT한 row를 바로 반환 */
  async create(data: {
    userId: number;
    displayName: string;
    bio?: string;
  }): Promise<SoundDesigner> {
    const res = await query<SoundDesigner>(
      `INSERT INTO sound_designers (user_id, display_name, bio)
       VALUES ($1, $2, $3)
       RETURNING ${COLUMNS}`,
      [data.userId, data.displayName, data.bio ?? null],  // bio 없으면 null
    );
    return res.rows[0];
  },

  /**
   * 디자이너 정보 수정 — 동적 UPDATE 패턴
   *
   * 전달된 필드만 SET 절에 포함:
   *   data = { displayName: "새 이름" }  → SET display_name = $1
   *   data = { displayName: "새 이름", bio: "소개" }  → SET display_name = $1, bio = $2
   *   data = {}  → 아무것도 안 바꿈 (현재 값 그대로 반환)
   *
   * $${i++}: 파라미터 인덱스를 동적으로 증가시키는 패턴
   *   i=1일 때 $${i++} → "$1" (그리고 i가 2로 증가)
   */
  async updateByUserId(
    userId: number,
    data: Partial<{ displayName: string; bio: string }>,
  ): Promise<SoundDesigner | undefined> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (data.displayName !== undefined) { sets.push(`display_name = $${i++}`); params.push(data.displayName); }
    if (data.bio !== undefined) { sets.push(`bio = $${i++}`); params.push(data.bio); }

    // 수정할 필드가 없으면 DB 쿼리 없이 현재 값 반환
    if (sets.length === 0) return this.findByUserId(userId);

    params.push(userId);  // WHERE 조건용 — 마지막 파라미터
    const res = await query<SoundDesigner>(
      `UPDATE sound_designers SET ${sets.join(", ")} WHERE user_id = $${i}
       RETURNING ${COLUMNS}`,
      params,
    );
    return res.rows[0];
  },

  /** 해당 디자이너가 올린 사운드 에셋 수 */
  async getSoundCount(designerId: number): Promise<number> {
    const res = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM sound_assets WHERE designer_id = $1`,
      [designerId],
    );
    // PostgreSQL의 COUNT()는 bigint 반환 → ::text로 변환 후 JS에서 Number()
    return Number(res.rows[0]?.count ?? 0);
  },

  /** 해당 디자이너 에셋의 총 다운로드 수 합계 */
  async getTotalDownloads(designerId: number): Promise<number> {
    const res = await query<{ total: string }>(
      // COALESCE: 에셋이 0개면 SUM이 null → 0으로 대체
      `SELECT COALESCE(SUM(download_count), 0)::text AS total FROM sound_assets WHERE designer_id = $1`,
      [designerId],
    );
    return Number(res.rows[0]?.total ?? 0);
  },
};
