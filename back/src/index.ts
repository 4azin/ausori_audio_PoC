import express from "express";
import session from "express-session";
import path from "path";
import swaggerUi from "swagger-ui-express";

import { connectRedis } from "./config/redis";
import { sessionConfig } from "./config/session";
import { errorHandler } from "./middleware/errorHandler";
import userRouter from "./users/user.router";
import projectRouter from "./projects/project.router";

// yamljs ships without bundled types, so require keeps the integration simple.
const YAML = require("yamljs");

const app = express();
const PORT = process.env.PORT || 3000;
const openApiPath = path.resolve(__dirname, "..", "openapi.yaml");
const swaggerDocument = YAML.load(openApiPath);

/** JSON 요청 본문 파싱 미들웨어 */
app.use(express.json());

/** 세션 미들웨어 (Redis 스토어) */
app.use(session(sessionConfig));

/** Swagger UI 문서 */
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    explorer: true,
    customSiteTitle: "Final PJT API Docs",
  })
);

/** 원본 OpenAPI 문서 */
app.get("/docs/openapi.yaml", (_req, res) => {
  res.sendFile(openApiPath);
});

/** 헬스체크 엔드포인트 */
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

/** 도메인 라우터 등록 */
app.use("/api/users", userRouter);
app.use("/api/projects", projectRouter);

/** 전역 에러 핸들러 — 반드시 라우터 등록 이후에 배치 */
app.use(errorHandler);

/** Redis 연결 후 서버 시작 */
async function bootstrap() {
  await connectRedis();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

bootstrap();
