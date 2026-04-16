import { pool } from "../config/db";
import { User } from "./user.types";

/** DB 컬럼(snake_case) → User 타입(camelCase) 변환 */
function toUser(row: Record<string, unknown>): User {
  return {
    id: row.id as number,
    email: row.email as string,
    name: row.name as string,
    profileImageUrl: row.profile_image_url as string | null,
    googleId: row.google_id as string,
    role: row.role as User["role"],
    plan: row.plan as User["plan"],
    monthlyUsageCount: row.monthly_usage_count as number,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

/** User DB 접근 레이어 — 쿼리와 스키마만 담당 */
export const userModel = {

  /** 전체 유저 조회 */
  async findAll(): Promise<User[]> {
    const { rows } = await pool.query("SELECT * FROM users ORDER BY created_at DESC");
    return rows.map(toUser);
  },

  /** 이메일로 유저 조회 */
  async findByEmail(email: string): Promise<User | undefined> {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    return rows[0] ? toUser(rows[0]) : undefined;
  },

  /** ID로 유저 단건 조회 */
  async findById(id: number): Promise<User | undefined> {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE id = $1",
      [id]
    );
    return rows[0] ? toUser(rows[0]) : undefined;
  },

  /** Google ID로 유저 조회 — 로그인 시 기존 회원 확인용 */
  async findByGoogleId(googleId: string): Promise<User | undefined> {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE google_id = $1",
      [googleId]
    );
    return rows[0] ? toUser(rows[0]) : undefined;
  },

  /**
   * Google OAuth 유저 upsert — 없으면 생성, 있으면 정보 갱신
   * 매번 로그인할 때마다 name, profile_image_url이 Google 최신 정보로 덮어써짐
   */
  async upsertByGoogleId(data: {
    googleId: string;
    email: string;
    name: string;
    profileImageUrl: string | null;
  }): Promise<User> {
    const { rows } = await pool.query(
      `INSERT INTO users (google_id, email, name, profile_image_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_id)
       DO UPDATE SET
         name = EXCLUDED.name,
         profile_image_url = EXCLUDED.profile_image_url,
         updated_at = now()
       RETURNING *`,
      [data.googleId, data.email, data.name, data.profileImageUrl]
    );
    return toUser(rows[0]);
  },

  /** 유저 생성 */
  async create(data: { email: string; name: string }): Promise<User> {
    const { rows } = await pool.query(
      `INSERT INTO users (email, name)
       VALUES ($1, $2)
       RETURNING *`,
      [data.email, data.name]
    );
    return toUser(rows[0]);
  },

  /** 유저 정보 수정 — 수정할 필드만 받아서 덮어씀 */
  async updateById(
    id: number,
    data: Partial<Pick<User, "name">>
  ): Promise<User | undefined> {
    const { rows } = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name), updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [data.name ?? null, id]
    );
    return rows[0] ? toUser(rows[0]) : undefined;
  },

  /** 유저 role 변경 */
  async updateRoleById(id: number, role: User["role"]): Promise<User | undefined> {
    const { rows } = await pool.query(
      `UPDATE users SET role = $1 WHERE id = $2 RETURNING *`,
      [role, id],
    );
    return rows[0] ? toUser(rows[0]) : undefined;
  },

  /** 유저 삭제 */
  async deleteById(id: number): Promise<boolean> {
    const { rowCount } = await pool.query(
      "DELETE FROM users WHERE id = $1",
      [id]
    );
    return (rowCount ?? 0) > 0;
  },
};
