import { Request, Response, NextFunction } from "express";

/**
 * 성공 응답을 {success: true, data: ...} 포맷으로 자동 감싸는 미들웨어.
 * 이미 success 키가 있는 객체는 그대로 통과시킨다 (에러 응답 등).
 */
export function responseWrapper(_req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);

  res.json = (body: unknown) => {
    if (body && typeof body === "object" && "success" in (body as object)) {
      return originalJson(body);
    }
    return originalJson({ success: true, data: body });
  };

  next();
}
