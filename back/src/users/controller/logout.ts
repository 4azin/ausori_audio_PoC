import { Request, Response } from "express";

import { logout as logoutService } from "../service";

/** 로그아웃 — 세션 파기 */
export async function logout(req: Request, res: Response) {
  await logoutService(req.session);

  res.status(200).json(null);
}
