import { userModel } from "../../models";

import { notFoundError } from "../../middleware/customError";

/** 유저 삭제 */
export async function deleteUser(id: number): Promise<void> {
  const deleted = await userModel.delete(id);

  if (!deleted) throw notFoundError("유저를 찾을 수 없습니다");
}
