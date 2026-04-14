import {
  projectModel,
  trackGroupModel,
  trackModel,
  trackEventModel,
} from "../../models";
import { notFoundError } from "../../middleware/customError";

/** 프로젝트 에디터 상태 로드 */
export async function loadProject(projectId: number, userId: string) {
  const project = await projectModel.findById(projectId);

  if (!project) throw notFoundError("프로젝트를 찾을 수 없습니다");
  if (project.userId !== userId) throw notFoundError("프로젝트를 찾을 수 없습니다");

  const trackGroups = await trackGroupModel.findAllByProjectId(projectId);
  const tracks = await trackModel.findAllByProjectId(projectId);
  const trackEvents = await trackEventModel.findAllByProjectId(projectId);

  // TODO: trackEvents.soundAssetId 기반으로 sound_assets 조회하여 soundAssets 맵 구성
  return {
    project,
    trackGroups,
    tracks,
    trackEvents,
    soundAssets: {},
  };
}
