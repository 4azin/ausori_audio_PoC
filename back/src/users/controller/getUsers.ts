import { Request, Response } from "express";
import { userService } from "../service";

/** 전체 유저 목록 조회 */
export async function getUsers(_req: Request, res: Response) {
  const users = await userService.getUsers();
  res.status(200).json(users);
}
