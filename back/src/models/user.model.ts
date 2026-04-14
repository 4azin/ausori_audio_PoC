import { User } from "./user.types";

// TODO: DB 연결 후 실제 쿼리로 교체 (현재 in-memory stub)
const users: User[] = [];
let nextId = 1;

/** User DB 접근 레이어 — 쿼리와 스키마만 담당 */
export const userModel = {

  /** ID로 유저 단건 조회 */
  async findById(id: number): Promise<User | undefined> {
    return users.find((u) => u.id === id);
  },

  /** Google ID로 유저 조회 — 로그인 시 기존 회원 확인용 */
  async findByGoogleId(googleId: string): Promise<User | undefined> {
    return users.find((u) => u.googleId === googleId);
  },

  /**
   * Google OAuth 유저 upsert — 없으면 생성, 있으면 정보 갱신
   * 매번 로그인할 때마다 name, profileImageUrl이 Google 최신 정보로 덮어써짐
   */
  async upsertByGoogleId(data: {
    googleId: string;
    email: string;
    name: string;
    profileImageUrl: string | null;
  }): Promise<User> {
    const existing = users.find((u) => u.googleId === data.googleId);

    if (existing) {
      // 기존 유저 — 이름/이미지만 최신으로 갱신
      existing.name = data.name;
      existing.profileImageUrl = data.profileImageUrl;
      existing.updatedAt = new Date();
      return existing;
    }

    // 신규 유저 생성
    const now = new Date();
    const user: User = {
      id: nextId++,
      googleId: data.googleId,
      email: data.email,
      name: data.name,
      profileImageUrl: data.profileImageUrl,
      role: "user",
      plan: "free",
      monthlyUsageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    users.push(user);
    return user;
  },

  /** 유저 정보 수정 — 수정할 필드만 받아서 덮어씀 */
  async updateById(
    id: number,
    data: Partial<Pick<User, "name">>
  ): Promise<User | undefined> {
    const user = users.find((u) => u.id === id);
    if (!user) return undefined;

    if (data.name !== undefined) user.name = data.name;
    user.updatedAt = new Date();
    return user;
  },

  /** 유저 삭제 */
  async deleteById(id: number): Promise<boolean> {
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) return false;
    users.splice(index, 1);
    return true;
  },
};
