/** 커스텀 에러 클래스 — statusCode + 에러 코드 포함 */
export class CustomError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, message: string, code = "ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const badRequestError = (message = "잘못된 요청입니다") =>
  new CustomError(400, message, "BAD_REQUEST");

export const unAuthError = (message = "로그인이 필요합니다") =>
  new CustomError(401, message, "UNAUTHORIZED");

export const alreadyLoggedInError = (message = "이미 로그인 상태입니다") =>
  new CustomError(403, message, "ALREADY_LOGGED_IN");

export const notFoundError = (message = "리소스를 찾을 수 없습니다") =>
  new CustomError(404, message, "NOT_FOUND");

export const conflictError = (message = "이미 존재하는 리소스입니다") =>
  new CustomError(409, message, "CONFLICT");

export const internalError = (message = "서버 내부 오류가 발생했습니다") =>
  new CustomError(500, message, "INTERNAL_ERROR");
