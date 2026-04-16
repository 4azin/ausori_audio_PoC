import { userModel, User } from "../../models";
import { notFoundError } from "../../middleware/customError";
import { UpdateMeDto } from "../dto";

/** 내 프로필 수정 — 수정할 필드만 받아서 업데이트 */
export async function updateMe(userId: number, data: UpdateMeDto): Promise<User> {
  const user = await userModel.updateById(userId, data);

  if (!user) throw notFoundError("유저를 찾을 수 없습니다");

  return user;
}
