import { Request, Response } from "express";

import { createProject as createProjectService } from "../service";

/** 프로젝트 생성 — validate 미들웨어에서 검증 완료된 body 사용 */
export async function createProject(req: Request, res: Response) {
  const userId = req.session.userId!;
  const { title } = req.body;

  const project = await createProjectService(userId, title);

  res.status(201).json(project);
}
