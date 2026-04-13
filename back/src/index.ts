import express from "express";
import session from "express-session";

import { sessionConfig } from "./config/session";
import { errorHandler } from "./middleware/errorHandler";
import userRouter from "./users/user.router";

const app = express();
const PORT = process.env.PORT || 3000;

/** JSON 요청 본문 파싱 미들웨어 */
app.use(express.json());

/** 세션 미들웨어 */
app.use(session(sessionConfig));

/** 헬스체크 엔드포인트 */
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

/** 도메인 라우터 등록 */
app.use("/api/users", userRouter);

/** 전역 에러 핸들러 — 반드시 라우터 등록 이후에 배치 */
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
