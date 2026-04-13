import { userModel, User } from "../../models";

/** 전체 유저 목록 조회 */
export async function getUsers(): Promise<User[]> {
  return userModel.findAll();
}
