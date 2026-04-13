import { User } from "./user.types";

// TODO: DB 연결 후 실제 쿼리로 교체 (현재 in-memory stub)
const users: User[] = [];
let nextId = 1;

/** User DB 접근 레이어 — 쿼리와 스키마만 담당 */
export const userModel = {
  /** 전체 유저 조회 */
  async findAll(): Promise<User[]> {
    return users;
  },

  /** ID로 유저 단건 조회 */
  async findById(id: number): Promise<User | undefined> {
    return users.find((u) => u.id === id);
  },

  /** 이메일로 유저 조회 */
  async findByEmail(email: string): Promise<User | undefined> {
    return users.find((u) => u.email === email);
  },

  /** 유저 생성 */
  async create(data: { email: string; nickname: string }): Promise<User> {
    const user: User = {
      id: nextId++,
      email: data.email,
      nickname: data.nickname,
      createdAt: new Date(),
    };
    users.push(user);
    return user;
  },

  /** 유저 정보 수정 */
  async update(
    id: number,
    data: Partial<{ email: string; nickname: string }>
  ): Promise<User | undefined> {
    const user = users.find((u) => u.id === id);
    if (!user) return undefined;
    if (data.email) user.email = data.email;
    if (data.nickname) user.nickname = data.nickname;
    return user;
  },

  /** 유저 삭제 */
  async delete(id: number): Promise<boolean> {
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) return false;
    users.splice(index, 1);
    return true;
  },
};
