import { Request, Response } from "express";

import { listSnapshots as listSnapshotsService } from "../service";

/** 스냅샷 히스토리 목록 */
export async function listSnapshots(req: Request, res: Response) {
  const projectId = Number(req.params.id);
  const userId = req.session.userId!;

  const result = await listSnapshotsService(projectId, userId);

  res.status(200).json(result);
}
