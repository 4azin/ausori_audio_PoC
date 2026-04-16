import { Request, Response } from "express";

import { deleteProject as deleteProjectService } from "../service";

/** 프로젝트 삭제 (소유자만) */
export async function deleteProject(req: Request, res: Response) {
  const id = Number(req.params.id);
  const userId = req.session.userId!;

  await deleteProjectService(id, userId);

  res.status(200).json(null);
}
