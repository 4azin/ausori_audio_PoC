import express from "express";
import session from "express-session";

import { sessionConfig } from "./config/session";
import { errorHandler } from "./middleware/errorHandler";
import { responseWrapper } from "./middleware/responseWrapper";
import userRouter from "./users/user.router";
import designerRouter from "./designers/designer.router";
import projectRouter from "./projects/project.router";
import soundRouter from "./sounds/sound.router";

const app = express();

/** JSON 요청 본문 파싱 미들웨어 */
app.use(express.json());

/** 세션 미들웨어 (Redis 스토어) */
app.use(session(sessionConfig));

/** 성공 응답 래퍼 — {success, data} 포맷으로 자동 감싸기 */
app.use(responseWrapper);

/** 헬스체크 엔드포인트 */
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

/** 도메인 라우터 등록 */
app.use("/api/users", userRouter);
app.use("/api/designers", designerRouter);
app.use("/api/projects", projectRouter);
app.use("/api/sounds", soundRouter);

/** 전역 에러 핸들러 — 반드시 라우터 등록 이후에 배치 */
app.use(errorHandler);

export default app;
