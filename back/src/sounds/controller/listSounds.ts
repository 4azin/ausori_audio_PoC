import { Request, Response } from "express";

import { listSounds as listSoundsService } from "../service";

export async function listSounds(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
  const majorId = req.query.majorId ? Number(req.query.majorId) : undefined;
  const midId = req.query.midId ? Number(req.query.midId) : undefined;
  const subId = req.query.subId ? Number(req.query.subId) : undefined;

  const result = await listSoundsService({ majorId, midId, subId, page, limit });
  res.status(200).json(result);
}
