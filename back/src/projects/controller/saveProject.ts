import { Request, Response } from "express";

import { saveProject as saveProjectService } from "../service";
import { SaveProjectDto } from "../dto";

/** 프로젝트 에디터 상태 저장 */
export async function saveProject(req: Request, res: Response) {
  const projectId = Number(req.params.id);
  const userId = req.session.userId!;
  const data = req.body as SaveProjectDto;

  const result = await saveProjectService(projectId, userId, data);

  res.status(201).json(result);
}
