import { Request, Response } from "express";

import { createUser as createUserService } from "../service";

/** 유저 생성 — validate 미들웨어에서 검증 완료된 body 사용 */
export async function createUser(req: Request, res: Response) {
  const { email, nickname } = req.body;
  
  const user = await createUserService(email, nickname);

  res.status(201).json(user);
}
