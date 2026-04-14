import { Request, Response } from "express";

import { updateProject as updateProjectService } from "../service";

/** 프로젝트 수정 (title만 허용) */
export async function updateProject(req: Request, res: Response) {
  const id = Number(req.params.id);
  const userId = req.session.userId!;
  const { title } = req.body;

  const project = await updateProjectService(id, userId, { title });

  res.status(200).json({ id: project.id, title: project.title });
}
