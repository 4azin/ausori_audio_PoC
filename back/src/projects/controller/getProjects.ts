import { Request, Response } from "express";

import { getProjects as getProjectsService } from "../service";

/** 사용자의 전체 프로젝트 목록 조회 */
export async function getProjects(req: Request, res: Response) {
  const userId = req.session.userId!;

  const projects = await getProjectsService(userId);

  res.status(200).json(projects);
}
