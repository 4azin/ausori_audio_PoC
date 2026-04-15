import { z } from "zod/v4";

/** Google OAuth 로그인 요청 검증 스키마 */
export const googleLoginDto = z.object({
  /** 프론트엔드에서 Google 인증 후 받은 authorization code */
  code: z.string().min(1, "code가 필요합니다"),
});

export type GoogleLoginDto = z.infer<typeof googleLoginDto>;
