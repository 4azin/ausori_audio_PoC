import { Request, Response } from "express";

import { getStatus as getStatusService } from "../service";

/** 프로젝트 AI 분석 진행 상태 조회 */
export async function getStatus(req: Request, res: Response) {
  const projectId = Number(req.params.id);
  const userId = req.session.userId!;

  const status = await getStatusService(projectId, userId);

  res.status(200).json(status);
}
