import { projectModel, Project } from "../../models";

import { notFoundError } from "../../middleware/customError";

/** ID로 프로젝트 단건 조회 */
export async function getProjectById(id: number): Promise<Project> {
  const project = await projectModel.findById(id);

  if (!project) throw notFoundError("프로젝트를 찾을 수 없습니다");

  return project;
}
