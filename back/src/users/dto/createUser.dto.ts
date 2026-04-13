import { z } from "zod/v4";

/** 유저 생성 요청 검증 스키마 */
export const createUserDto = z.object({
  email: z.email("올바른 이메일 형식이 아닙니다"),
  nickname: z
    .string()
    .min(2, "닉네임은 2자 이상이어야 합니다")
    .max(20, "닉네임은 20자 이하여야 합니다"),
});

export type CreateUserDto = z.infer<typeof createUserDto>;
