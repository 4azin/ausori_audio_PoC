import { z } from "zod/v4";

/** 내 프로필 수정 요청 검증 스키마 */
export const updateMeDto = z.object({
  name: z
    .string()
    .min(1, "이름은 1자 이상이어야 합니다")
    .max(50, "이름은 50자 이하여야 합니다")
    .optional(),
});

export type UpdateMeDto = z.infer<typeof updateMeDto>;
