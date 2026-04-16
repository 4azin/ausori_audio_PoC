import { Request, Response } from "express";

import { deleteSound as deleteSoundService } from "../service";

export async function deleteSound(req: Request, res: Response) {
  const userId = req.session.userId!;
  const soundId = Number(req.params.soundId);

  await deleteSoundService(userId, soundId);

  res.status(200).json(null);
}
