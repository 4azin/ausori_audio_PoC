import { z } from "zod/v4";

/** 프로젝트 수정 요청 검증 스키마 — 모든 필드 선택적 */
export const updateProjectDto = z.object({
  title: z
    .string()
    .min(1, "프로젝트 제목은 필수입니다")
    .max(100, "프로젝트 제목은 100자 이하여야 합니다")
    .optional(),
  status: z
    .enum(["uploading", "analyzing", "ready", "rendering", "done", "failed"])
    .optional(),
});

export type UpdateProjectDto = z.infer<typeof updateProjectDto>;
