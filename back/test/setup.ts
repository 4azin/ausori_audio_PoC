import { pool, closePool } from "../src/config/db";

/**
 * 테스트 전: DB 연결 확인
 * 테스트 후: 풀 정리
 *
 * 주의: docker-compose의 postgres가 실행 중이어야 함
 * DB_PASSWORD 환경변수 필요 (또는 .env 로드)
 */

beforeAll(async () => {
  // dotenv 로드 (테스트 환경)
  require("dotenv").config({ path: `${__dirname}/../.env` });

  // DB 연결 확인
  const res = await pool.query("SELECT 1 AS ok");
  if (res.rows[0]?.ok !== 1) {
    throw new Error("DB connection check failed");
  }
});

afterAll(async () => {
  await closePool();
});
