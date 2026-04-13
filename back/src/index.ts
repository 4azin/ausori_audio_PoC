import express from "express";
import userRouter from "./users/user.router";

const app = express();
const PORT = process.env.PORT || 3000;

/** JSON 요청 본문 파싱 미들웨어 */
app.use(express.json());

/** 헬스체크 엔드포인트 */
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

/** 도메인 라우터 등록 */
app.use("/api/users", userRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
