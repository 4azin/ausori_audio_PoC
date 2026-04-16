import { createClient } from "redis";

/** Redis 연결 URL 생성 — password / TLS 지원 */
function buildRedisUrl(): string {
  const host = process.env.REDIS_HOST || "localhost";
  const port = process.env.REDIS_PORT || 6379;
  const password = process.env.REDIS_PASSWORD || "";
  const useTls = process.env.REDIS_TLS === "true";

  const protocol = useTls ? "rediss" : "redis";
  const auth = password ? `:${encodeURIComponent(password)}@` : "";

  return `${protocol}://${auth}${host}:${port}`;
}

export const redisClient = createClient({ url: buildRedisUrl() });

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
