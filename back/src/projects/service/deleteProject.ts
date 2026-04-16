import { projectModel } from "../../models";
import { notFoundError } from "../../middleware/customError";

/** 프로젝트 삭제 (소유자 체크 포함) */
export async function deleteProject(id: number, userId: number): Promise<void> {
  const existing = await projectModel.findById(id);
  if (!existing) throw notFoundError("프로젝트를 찾을 수 없습니다");
  if (existing.userId !== userId) throw notFoundError("프로젝트를 찾을 수 없습니다");

  await projectModel.delete(id);
}
