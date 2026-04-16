import { projectModel, Project } from "../../models";
import { notFoundError } from "../../middleware/customError";

/** 프로젝트 메타 단건 조회 (소유자 체크 포함) */
export async function getProjectById(id: number, userId: number): Promise<Project> {
  const project = await projectModel.findById(id);

  if (!project) throw notFoundError("프로젝트를 찾을 수 없습니다");
  if (project.userId !== userId) throw notFoundError("프로젝트를 찾을 수 없습니다");

  return project;
}
