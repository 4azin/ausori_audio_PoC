import { Request, Response } from "express";

import { devLogin as devLoginService } from "../service";

/** 개발용 임시 로그인 — body: { email, name } */
export async function devLogin(req: Request, res: Response) {
  const { email, name } = req.body;

  const user = await devLoginService(email, name);

  req.session.userId = user.id;
  req.session.userRole = user.role;

  res.status(200).json({
    id: user.id,
    email: user.email,
    name: user.name,
    profileImageUrl: user.profileImageUrl,
    role: user.role,
    plan: user.plan,
  });
}
