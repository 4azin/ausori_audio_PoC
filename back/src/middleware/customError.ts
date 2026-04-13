/** 커스텀 에러 클래스 — statusCode를 포함하여 에러 핸들러에서 활용 */
export class CustomError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** 400 — 잘못된 요청 */
export const badRequestError = (message = "잘못된 요청입니다") =>
  new CustomError(400, message);

/** 401 — 인증 필요 (로그인 안 됨) */
export const unAuthError = (message = "로그인이 필요합니다") =>
  new CustomError(401, message);

/** 403 — 이미 로그인 상태 */
export const alreadyLoggedInError = (message = "이미 로그인 상태입니다") =>
  new CustomError(403, message);

/** 404 — 리소스 없음 */
export const notFoundError = (message = "리소스를 찾을 수 없습니다") =>
  new CustomError(404, message);

/** 409 — 중복 충돌 */
export const conflictError = (message = "이미 존재하는 리소스입니다") =>
  new CustomError(409, message);

/** 500 — 서버 내부 오류 */
export const internalError = (message = "서버 내부 오류가 발생했습니다") =>
  new CustomError(500, message);
