import { Request, Response } from "express";

import { updateMe as updateMeService } from "../service";

/** 내 프로필 수정 */
export async function updateMe(req: Request, res: Response) {
  const userId = req.session.userId!;

  const user = await updateMeService(userId, req.body);

  res.status(200).json({
    id: user.id,
    name: user.name,
  });
}
