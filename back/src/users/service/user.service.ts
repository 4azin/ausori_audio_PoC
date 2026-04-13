import { userModel, User } from "../../models";

/** User 비즈니스 로직 레이어 — Express를 모른다 */
export const userService = {
  /** 전체 유저 목록 조회 */
  async getUsers(): Promise<User[]> {
    return userModel.findAll();
  },

  /** ID로 유저 단건 조회 */
  async getUserById(id: number): Promise<User> {
    const user = await userModel.findById(id);
    if (!user) throw new Error("User not found");
    return user;
  },

  /** 유저 생성 — 이메일 중복 검사 포함 */
  async createUser(email: string, nickname: string): Promise<User> {
    const existing = await userModel.findByEmail(email);
    if (existing) throw new Error("Email already exists");
    return userModel.create({ email, nickname });
  },

  /** 유저 정보 수정 */
  async updateUser(
    id: number,
    data: Partial<{ email: string; nickname: string }>
  ): Promise<User> {
    const user = await userModel.update(id, data);
    if (!user) throw new Error("User not found");
    return user;
  },

  /** 유저 삭제 */
  async deleteUser(id: number): Promise<void> {
    const deleted = await userModel.delete(id);
    if (!deleted) throw new Error("User not found");
  },
};
