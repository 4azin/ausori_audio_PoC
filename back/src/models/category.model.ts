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

  async findSubsByMid(midId: number): Promise<CategorySub[]> {
    const res = await query<CategorySub>(
      `SELECT id, mid_id AS "midId", name FROM category_sub WHERE mid_id = $1 ORDER BY id`,
      [midId],
    );
    return res.rows;
  },
};
