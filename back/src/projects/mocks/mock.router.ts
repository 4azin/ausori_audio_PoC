import { Router, Request, Response } from "express";

import { buildMockStatus, buildMockProjectDetail } from "./data";

/** 프론트 개발용 목 라우터 — 인증/DB 없이 고정 응답 반환 */
const mockRouter = Router();

mockRouter.get("/:id/status", (req: Request, res: Response) => {
  res.status(200).json(buildMockStatus(Number(req.params.id)));
});

mockRouter.get("/:id/load", (req: Request, res: Response) => {
  res.status(200).json(buildMockProjectDetail(Number(req.params.id)));
});

export default mockRouter;
