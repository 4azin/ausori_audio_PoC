import "express-session";

/** express-session에 커스텀 세션 필드 확장 */
declare module "express-session" {
  interface SessionData {
    /** 로그인한 유저의 DB id */
    userId: string;
    /** 로그인한 유저의 role — 권한 체크 미들웨어에서 사용 */
    userRole: "user" | "designer" | "admin";
  }
}
