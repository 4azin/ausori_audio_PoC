import { Request, Response } from "express";

import { getDesignerMe } from "../service";

export async function getMe(req: Request, res: Response) {
  const userId = req.session.userId!;

  const { designer, soundCount, totalDownloads } = await getDesignerMe(userId);

  res.status(200).json({
    id: designer.id,
    displayName: designer.displayName,
    bio: designer.bio,
    revenueShareRate: designer.revenueShareRate,
    soundCount,
    totalDownloads,
  });
}
