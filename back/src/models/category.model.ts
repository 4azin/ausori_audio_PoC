import { query } from "../config/db";
import { CategoryMajor, CategoryMid, CategorySub } from "./category.types";

export const categoryModel = {
  async findAllMajors(): Promise<CategoryMajor[]> {
    const res = await query<CategoryMajor>(
      `SELECT id, name FROM category_major ORDER BY id`,
    );
    return res.rows;
  },

  async findMidsByMajor(majorId: number): Promise<CategoryMid[]> {
    const res = await query<CategoryMid>(
      `SELECT id, major_id AS "majorId", name FROM category_mid WHERE major_id = $1 ORDER BY id`,
      [majorId],
    );
    return res.rows;
  },

  /**
   * 특정 mid 하위에서 실제 사용된 sub 만 반환 (sound_assets 데이터 기반).
   * sub 자체는 flat 라벨 풀이므로 카테고리 트리에 의미 있는 sub 만 노출하기 위해
   * sound_assets 와 조인.
   */
  async findSubsByMid(midId: number): Promise<CategorySub[]> {
    const res = await query<CategorySub>(
      `SELECT DISTINCT cs.id, cs.name
       FROM sound_assets sa
       JOIN category_sub cs ON cs.id = sa.sub_id
       WHERE sa.mid_id = $1
       ORDER BY cs.id`,
      [midId],
    );
    return res.rows;
  },

  async findAllSubs(): Promise<CategorySub[]> {
    const res = await query<CategorySub>(
      `SELECT id, name FROM category_sub ORDER BY id`,
    );
    return res.rows;
  },

  /**
   * categoryPath = [majorName, midName, subName] → (major_id, mid_id, sub_id?)
   * sub 는 flat 라벨이라 동일 이름이 여러 sub_id 로 존재 가능.
   * 그래서 (major_id, mid_id) 하위에서 실제로 사용되는 sub 중 이름 매칭으로 좁힌다.
   * sub 매칭 실패 시 sub_id 는 null (vectorSearch 가 sub 필터 없이 진행).
   */
  async resolvePath(
    majorName: string,
    midName: string,
    subName: string,
  ): Promise<{ majorId: number; midId: number; subId: number | null } | null> {
    const res = await query<{ majorId: number; midId: number; subId: number | null }>(
      `WITH ma AS (
         SELECT id FROM category_major WHERE name = $1
       ), mi AS (
         SELECT cm.id
         FROM category_mid cm JOIN ma ON cm.major_id = ma.id
         WHERE cm.name = $2
       ), su AS (
         SELECT cs.id
         FROM sound_assets sa
         JOIN category_sub cs ON cs.id = sa.sub_id
         JOIN ma ON sa.major_id = ma.id
         JOIN mi ON sa.mid_id = mi.id
         WHERE cs.name = $3
         GROUP BY cs.id
         ORDER BY COUNT(*) DESC, cs.id ASC
         LIMIT 1
       )
       SELECT ma.id AS "majorId", mi.id AS "midId",
              (SELECT id FROM su) AS "subId"
       FROM ma, mi`,
      [majorName, midName, subName],
    );
    return res.rows[0] ?? null;
  },
};
