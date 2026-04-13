import { userModel, User } from "../../models";
import { notFoundError } from "../../middleware/customError";

/** ID로 유저 단건 조회 */
export async function getUserById(id: number): Promise<User> {
  const user = await userModel.findById(id);
  if (!user) throw notFoundError("유저를 찾을 수 없습니다");
  return user;
}
