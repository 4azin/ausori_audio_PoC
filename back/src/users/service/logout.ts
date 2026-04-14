import { Session } from "express-session";

/**
 * 로그아웃 — 서버 세션을 완전히 파기
 *
 * session.destroy()는 콜백 기반이라 Promise로 감싸서 사용
 */
export async function logout(session: Session): Promise<void> {
  return new Promise((resolve, reject) => {
    session.destroy((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
