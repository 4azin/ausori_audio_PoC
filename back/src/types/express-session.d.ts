import "express-session";

/** express-session에 커스텀 세션 필드 확장 */
declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}
