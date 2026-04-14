import { projectModel, projectSnapshotModel } from "../../models";
import { notFoundError } from "../../middleware/customError";

/** 스냅샷 히스토리 목록 */
export async function listSnapshots(projectId: number, userId: number) {
  const project = await projectModel.findById(projectId);
  if (!project) throw notFoundError("프로젝트를 찾을 수 없습니다");
  if (project.userId !== userId) throw notFoundError("프로젝트를 찾을 수 없습니다");

  const snapshots = await projectSnapshotModel.listByProjectId(projectId);
  return { snapshots };
}
