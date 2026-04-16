import { Request, Response, NextFunction } from "express";

import { CustomError } from "./customError";

/** 전역 에러 핸들러 — CustomError면 statusCode 사용, 아니면 500 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof CustomError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "서버 내부 오류가 발생했습니다" },
  });
}
