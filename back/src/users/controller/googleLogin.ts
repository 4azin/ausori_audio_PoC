import { Request, Response } from "express";

import { googleLogin as googleLoginService } from "../service";

/** Google OAuth 로그인 / 회원가입 */
export async function googleLogin(req: Request, res: Response) {
  const { code } = req.body;

  const user = await googleLoginService(code);

  // 로그인 성공 — 세션에 userId와 role 저장
  req.session.userId = user.id;
  req.session.userRole = user.role;

  res.status(200).json(user);
}
