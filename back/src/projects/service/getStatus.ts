import { projectModel } from "../../models";
import { notFoundError } from "../../middleware/customError";

/** 프로젝트 AI 분석 진행 상태 조회 */
export async function getStatus(projectId: number, userId: string) {
  const project = await projectModel.findById(projectId);

  if (!project) throw notFoundError("프로젝트를 찾을 수 없습니다");
  if (project.userId !== userId) throw notFoundError("프로젝트를 찾을 수 없습니다");

  // TODO: Redis jobRepository.getProgress로 실제 진행 상태 조회
  throw new Error("getStatus not implemented — Redis jobRepository 연동 필요");
}
