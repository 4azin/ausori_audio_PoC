import { userModel, User } from "../../models";

import { notFoundError } from "../../middleware/customError";

/** 유저 정보 수정 */
export async function updateUser(
  id: number,
  data: Partial<{ name: string }>
): Promise<User> {
  const user = await userModel.updateById(id, data);

  if (!user) throw notFoundError("유저를 찾을 수 없습니다");

  return user;
}
