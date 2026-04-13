import { z } from "zod/v4";

/** 프로젝트 생성 요청 검증 스키마 */
export const createProjectDto = z.object({
  title: z
    .string()
    .min(1, "프로젝트 제목은 필수입니다")
    .max(100, "프로젝트 제목은 100자 이하여야 합니다"),
});

export type CreateProjectDto = z.infer<typeof createProjectDto>;
