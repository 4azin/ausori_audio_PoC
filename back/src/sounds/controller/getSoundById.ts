import { Request, Response } from "express";

import { getSoundById as getSoundByIdService } from "../service";

export async function getSoundById(req: Request, res: Response) {
  const id = Number(req.params.id);
  const sound = await getSoundByIdService(id);
  res.status(200).json(sound);
}
