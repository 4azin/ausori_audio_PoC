import { z } from "zod/v4";

/**
 * 디자이너 등록 요청 body 검증 스키마
 *
 * zod 사용법:
 *   z.string()          → 문자열이어야 함
 *   .min(1)             → 빈 문자열 불가
 *   .max(100)           → 100자 이하
 *   .optional()         → 필드 자체가 없어도 OK (있으면 검증)
 *
 * validate(registerDto) 미들웨어가 req.body를 이 스키마로 검증
 *   → 통과: req.body에 검증된 값 세팅 → 다음 미들웨어로
 *   → 실패: 400 VALIDATION_ERROR 자동 응답
 */
export const registerDto = z.object({
  displayName: z.string().min(1).max(100),
  bio: z.string().max(1000).optional(),
});
