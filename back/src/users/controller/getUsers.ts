import { Request, Response } from "express";

import { getUsers as getUsersService } from "../service";

/** 전체 유저 목록 조회 */
export async function getUsers(_req: Request, res: Response) {
  const users = await getUsersService();

  res.status(200).json(users);
}
