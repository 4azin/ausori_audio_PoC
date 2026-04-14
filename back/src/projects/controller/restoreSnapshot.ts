import { Request, Response } from "express";

import { restoreSnapshot as restoreSnapshotService } from "../service";

/** 특정 버전으로 복원 */
export async function restoreSnapshot(req: Request, res: Response) {
  const projectId = Number(req.params.id);
  const version = Number(req.params.version);
  const userId = req.session.userId!;

  const result = await restoreSnapshotService(projectId, userId, version);

  res.status(200).json(result);
}
