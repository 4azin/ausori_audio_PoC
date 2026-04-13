import { createClient } from "redis";

/** Redis 클라이언트 설정 및 초기화 */
const redisUrl = `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}`;

export const redisClient = createClient({ url: redisUrl });

redisClient.on("error", (err) => {
  console.error("Redis 연결 오류:", err);
});

redisClient.on("connect", () => {
  console.log("Redis 연결 성공");
});

/** Redis 연결 함수 — 서버 시작 시 호출 */
export async function connectRedis() {
  await redisClient.connect();
}
