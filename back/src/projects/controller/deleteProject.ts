import { Request, Response } from "express";

import { deleteProject as deleteProjectService } from "../service";

/** 프로젝트 삭제 */
export async function deleteProject(req: Request, res: Response) {
  const id = Number(req.params.id);

  await deleteProjectService(id);

  res.status(204).send();
}
