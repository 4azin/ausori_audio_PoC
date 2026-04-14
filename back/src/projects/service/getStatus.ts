import { projectModel } from "../../models";
import { jobRepository } from "../../jobs";
import { notFoundError } from "../../middleware/customError";

/** 프로젝트 AI 분석 진행 상태 조회 — Redis progress를 읽어 반환 */
export async function getStatus(projectId: number, userId: number) {
  const project = await projectModel.findById(projectId);

  if (!project) throw notFoundError("프로젝트를 찾을 수 없습니다");
  if (project.userId !== userId) throw notFoundError("프로젝트를 찾을 수 없습니다");

  // 분석 완료 후 DB에 반영된 상태이면 그대로 반환
  if (project.status === "ready") {
    return {
      projectId,
      jobId: null,
      status: "ready",
      currentStage: "done",
      progress: 100,
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  const jobId = await jobRepository.getJobIdForProject(projectId);
  if (!jobId) {
    return {
      projectId,
      jobId: null,
      status: project.status,
      currentStage: "pending",
      progress: 0,
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  const progress = await jobRepository.getProgress(jobId);
  if (!progress) {
    return {
      projectId,
      jobId,
      status: project.status,
      currentStage: "pending",
      progress: 0,
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  return {
    projectId,
    jobId,
    status: progress.status,
    currentStage: progress.currentStage ?? progress.status,
    progress: progress.progress,
    updatedAt: progress.updatedAt ?? new Date().toISOString(),
  };
}
