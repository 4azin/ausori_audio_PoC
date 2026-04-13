import { Request, Response } from "express";

import { updateUser as updateUserService } from "../service";

/** 유저 수정 — validate 미들웨어에서 검증 완료된 body 사용 */
export async function updateUser(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { email, nickname } = req.body;
  const user = await updateUserService(id, { email, nickname });

  res.status(200).json(user);
}
