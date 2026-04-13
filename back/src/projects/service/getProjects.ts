import { projectModel, Project } from "../../models";

/** 사용자의 전체 프로젝트 목록 조회 */
export async function getProjects(userId: number): Promise<Project[]> {
  return projectModel.findAllByUserId(userId);
}
