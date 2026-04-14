import { projectModel, Project } from "../../models";

/** 프로젝트 생성 */
export async function createProject(userId: string, title: string): Promise<Project> {
  return projectModel.create({ userId, title });
}
