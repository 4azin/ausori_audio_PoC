import { Request, Response } from "express";

import { getProjects as getProjectsService } from "../service";

/** 사용자의 프로젝트 목록 조회 (페이지네이션) */
export async function getProjects(req: Request, res: Response) {
  const userId = req.session.userId!;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 10));

  const result = await getProjectsService(userId, page, limit);

  res.status(200).json(result);
}
