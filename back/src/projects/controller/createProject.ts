import { Request, Response } from "express";

import { createProject as createProjectService } from "../service";

/** 프로젝트 생성 */
export async function createProject(req: Request, res: Response) {
  const userId = req.session.userId!;
  const { title } = req.body;

  const project = await createProjectService(userId, title);

  res.status(201).json({
    id: project.id,
    title: project.title,
    status: project.status,
    createdAt: project.createdAt,
  });
}
