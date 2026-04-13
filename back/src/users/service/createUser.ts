import { userModel, User } from "../../models";
import { conflictError } from "../../middleware/customError";

/** 유저 생성 — 이메일 중복 검사 포함 */
export async function createUser(email: string, nickname: string): Promise<User> {
  const existing = await userModel.findByEmail(email);
  if (existing) throw conflictError("이미 존재하는 이메일입니다");
  return userModel.create({ email, nickname });
}
