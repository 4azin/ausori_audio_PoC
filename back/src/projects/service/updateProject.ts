import { projectModel, Project } from "../../models";
import { notFoundError } from "../../middleware/customError";

/** 프로젝트 정보 수정 (소유자 체크 포함) */
export async function updateProject(
  id: number,
  userId: number,
  data: Partial<{ title: string }>,
): Promise<Project> {
  const existing = await projectModel.findById(id);
  if (!existing) throw notFoundError("프로젝트를 찾을 수 없습니다");
  if (existing.userId !== userId) throw notFoundError("프로젝트를 찾을 수 없습니다");

  const updated = await projectModel.update(id, data);
  if (!updated) throw notFoundError("프로젝트를 찾을 수 없습니다");
  return updated;
}
