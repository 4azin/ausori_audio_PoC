import { Request, Response, NextFunction } from "express";
import { ZodType } from "zod/v4";

/**
 * Zod 스키마로 req.body를 검증하는 미들웨어 팩토리
 * — 라우터에서 validate(createUserDto) 형태로 체이닝
 */
export function validate(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);

    next();
  };
}
