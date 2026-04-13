import { projectModel, Project } from "../../models";

import { notFoundError } from "../../middleware/customError";

/** 프로젝트 정보 수정 */
export async function updateProject(
  id: number,
  data: Partial<{ title: string; status: string }>
): Promise<Project> {
  const project = await projectModel.update(id, data);

  if (!project) throw notFoundError("프로젝트를 찾을 수 없습니다");

  return project;
}
