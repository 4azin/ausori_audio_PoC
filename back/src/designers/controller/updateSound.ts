import { Request, Response } from "express";

import { updateSound as updateSoundService } from "../service";

export async function updateSound(req: Request, res: Response) {
  const userId = req.session.userId!;
  const soundId = Number(req.params.soundId);

  const result = await updateSoundService(userId, soundId, req.body);

  res.status(200).json({ id: result!.id });
}
