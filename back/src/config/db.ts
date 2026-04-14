import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

/** Postgres 연결 풀 — 전역 싱글턴 */
export const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "app",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  max: 20,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  console.error("[db] unexpected pool error:", err);
});

/**
 * 모델 레이어에서 풀/트랜잭션 클라이언트 어느 쪽으로도 동작할 수 있도록
 * (text, params) 단일 시그니처만 노출하는 최소 인터페이스.
 */
export interface Runner {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
}

export const db: Runner = {
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ) => pool.query<T>(text, params as never),
};

/** 간단 쿼리 실행 — db.query의 shortcut */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return db.query<T>(text, params);
}

/**
 * 트랜잭션 헬퍼 — BEGIN/COMMIT/ROLLBACK 자동 처리.
 * 콜백에는 Runner 인터페이스에 맞춘 어댑터를 전달한다.
 */
export async function withTransaction<T>(
  fn: (runner: Runner) => Promise<T>,
): Promise<T> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");
    const adapter: Runner = {
      query: <R extends QueryResultRow = QueryResultRow>(
        text: string,
        params?: unknown[],
      ) => client.query<R>(text, params as never),
    };
    const result = await fn(adapter);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** 서버 종료 시 풀 정리 */
export async function closePool(): Promise<void> {
  await pool.end();
}
