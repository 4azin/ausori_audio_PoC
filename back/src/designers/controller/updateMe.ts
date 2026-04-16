import { Request, Response } from "express";

import { updateDesignerMe } from "../service";

export async function updateMe(req: Request, res: Response) {
  const userId = req.session.userId!;

  const designer = await updateDesignerMe(userId, req.body);

  res.status(200).json({
    id: designer.id,
    displayName: designer.displayName,
    bio: designer.bio,
  });
}
