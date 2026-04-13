import { Request, Response } from "express";

import { updateProject as updateProjectService } from "../service";

/** 프로젝트 수정 — validate 미들웨어에서 검증 완료된 body 사용 */
export async function updateProject(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { title, status } = req.body;

  const project = await updateProjectService(id, { title, status });

  res.status(200).json(project);
}
