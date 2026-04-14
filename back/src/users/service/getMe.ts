import { userModel, User } from "../../models";
import { notFoundError } from "../../middleware/customError";

/** 내 프로필 조회 — 세션의 userId로 DB에서 유저 정보 반환 */
export async function getMe(userId: number): Promise<User> {
  const user = await userModel.findById(userId);

  if (!user) throw notFoundError("유저를 찾을 수 없습니다");

  return user;
}
