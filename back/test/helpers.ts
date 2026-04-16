import { Request, Response, NextFunction } from "express";

/**
 * supertest용: 세션에 userId를 주입하는 미들웨어.
 * app.use(mockAuth(userId))를 테스트 앱에 추가하면
 * isAuthenticated 미들웨어를 통과함.
 */
export function mockAuth(userId: number) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.session = req.session || ({} as any);
    req.session.userId = userId;
    next();
  };
}

/**
 * 테스트용 유저 생성 — DB에 직접 INSERT
 */
export async function createTestUser(
  pool: import("pg").Pool,
  overrides: Partial<{
    email: string;
    name: string;
    googleId: string;
  }> = {},
) {
  const email = overrides.email ?? `test-${Date.now()}@test.com`;
  const name = overrides.name ?? "Test User";
  const googleId = overrides.googleId ?? `google-${Date.now()}`;

  const res = await pool.query(
    `INSERT INTO users (email, name, google_id)
     VALUES ($1, $2, $3)
     RETURNING id, email, name`,
    [email, name, googleId],
  );
  return res.rows[0] as { id: number; email: string; name: string };
}

/**
 * 테스트용 프로젝트 생성 — DB에 직접 INSERT
 */
export async function createTestProject(
  pool: import("pg").Pool,
  userId: number,
  overrides: Partial<{ title: string; status: string }> = {},
) {
  const title = overrides.title ?? "Test Project";
  const status = overrides.status ?? "ready";

  const res = await pool.query(
    `INSERT INTO projects (user_id, title, status)
     VALUES ($1, $2, $3::project_status)
     RETURNING id, title, status`,
    [userId, title, status],
  );
  return res.rows[0] as { id: number; title: string; status: string };
}
