import { projectModel } from "../../models";
import { notFoundError } from "../../middleware/customError";
import { buildMockStatus } from "../mocks";

/** 프로젝트 AI 분석 진행 상태 조회 (현재는 목 데이터) */
export async function getStatus(projectId: number, userId: number) {
  const project = await projectModel.findById(projectId);

  if (!project) throw notFoundError("프로젝트를 찾을 수 없습니다");
  if (project.userId !== userId) throw notFoundError("프로젝트를 찾을 수 없습니다");

  // TODO: 실제 구현 시 Redis jobRepository.getProgress로 교체
  return buildMockStatus(projectId, project.createdAt);
}
