import { Router, Request, Response } from "express";

import { buildMockStatus, buildMockSnapshot, buildMockSoundAssets } from "./data";

/** 프론트 개발용 목 라우터 — 인증/DB 없이 고정 응답 반환 */
const mockRouter = Router();

mockRouter.get("/:id/status", (req: Request, res: Response) => {
  const projectId = Number(req.params.id);
  res.status(200).json(buildMockStatus(projectId));
});

mockRouter.get("/:id/load", (req: Request, res: Response) => {
  const projectId = Number(req.params.id);
  const now = new Date();

  res.status(200).json({
    project: {
      id: projectId,
      userId: 0,
      title: `Mock Project ${projectId}`,
      status: "ready",
      originalVideoUrl: null,
      finalVideoUrl: null,
      durationSeconds: 30,
      createdAt: now,
      updatedAt: now,
    },
    ...buildMockSnapshot(projectId),
    soundAssets: buildMockSoundAssets(),
  });
});

export default mockRouter;
