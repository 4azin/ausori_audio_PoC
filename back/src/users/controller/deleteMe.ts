import { Request, Response } from "express";

import { deleteMe as deleteMeService } from "../service";

/** 회원 탈퇴 */
export async function deleteMe(req: Request, res: Response) {
  const userId = req.session.userId!;

  await deleteMeService(userId, req.session);

  res.status(200).json({ message: "회원 탈퇴가 완료되었습니다" });
}
