import { Request, Response } from "express";

import { getMe as getMeService } from "../service";

/** 내 프로필 조회 */
export async function getMe(req: Request, res: Response) {
  const userId = req.session.userId!;

  const user = await getMeService(userId);

  res.status(200).json(user);
}
