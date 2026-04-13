import { Request, Response } from "express";

import { loadProject as loadProjectService } from "../service";

/** 프로젝트 에디터 상태 로드 */
export async function loadProject(req: Request, res: Response) {
  const projectId = Number(req.params.id);
  const userId = req.session.userId!;

  const data = await loadProjectService(projectId, userId);

  res.status(200).json(data);
}
