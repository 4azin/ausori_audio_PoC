import { Request, Response } from "express";

import { getSimilarSounds as getSimilarSoundsService } from "../service";

/** 유사 에셋 벡터 검색 */
export async function getSimilarSounds(req: Request, res: Response) {
  const projectId = Number(req.params.id);
  const userId = req.session.userId!;

  const aiEventId = req.query.aiEventId ? Number(req.query.aiEventId) : undefined;
  const soundAssetId = req.query.soundAssetId ? Number(req.query.soundAssetId) : undefined;
  const level = (req.query.level as "major" | "mid" | "sub") || undefined;
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);

  const result = await getSimilarSoundsService({
    projectId,
    userId,
    aiEventId,
    soundAssetId,
    level,
    categoryId,
    limit,
    offset,
  });

  res.status(200).json(result);
}
