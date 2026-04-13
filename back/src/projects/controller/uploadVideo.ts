import { Request, Response } from "express";

import { uploadVideo as uploadVideoService } from "../service";
import { badRequestError } from "../../middleware/customError";

/** 프로젝트 영상 업로드 */
export async function uploadVideo(req: Request, res: Response) {
  const projectId = Number(req.params.id);
  const userId = req.session.userId!;

  if (!req.file) throw badRequestError("파일이 필요합니다");

  const result = await uploadVideoService(projectId, userId, req.file);

  res.status(200).json(result);
}
