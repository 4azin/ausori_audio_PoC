import { Request, Response } from "express";

import { getProjectById as getProjectByIdService } from "../service";

/** ID로 프로젝트 단건 조회 (소유자만) */
export async function getProjectById(req: Request, res: Response) {
  const id = Number(req.params.id);
  const userId = req.session.userId!;

  const { userId: _uid, ...project } = await getProjectByIdService(id, userId);

  res.status(200).json(project);
}
