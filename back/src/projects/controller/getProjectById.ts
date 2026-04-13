import { Request, Response } from "express";

import { getProjectById as getProjectByIdService } from "../service";

/** ID로 프로젝트 단건 조회 */
export async function getProjectById(req: Request, res: Response) {
  const id = Number(req.params.id);

  const project = await getProjectByIdService(id);

  res.status(200).json(project);
}
