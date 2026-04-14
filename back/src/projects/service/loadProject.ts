import {
  projectModel,
  trackGroupModel,
  trackModel,
  trackEventModel,
} from "../../models";
import { notFoundError } from "../../middleware/customError";
import { buildMockSnapshot, buildMockSoundAssets } from "../mocks";

/** 프로젝트 에디터 상태 로드 */
export async function loadProject(projectId: number, userId: number) {
  const project = await projectModel.findById(projectId);

  if (!project) throw notFoundError("프로젝트를 찾을 수 없습니다");
  if (project.userId !== userId) throw notFoundError("프로젝트를 찾을 수 없습니다");

  const trackGroups = await trackGroupModel.findAllByProjectId(projectId);
  const tracks = await trackModel.findAllByProjectId(projectId);
  const trackEvents = await trackEventModel.findAllByProjectId(projectId);

  // 저장된 상태가 없으면 목 스냅샷으로 대체 (프론트 개발용)
  if (trackGroups.length === 0) {
    return {
      project,
      ...buildMockSnapshot(projectId),
      soundAssets: buildMockSoundAssets(),
    };
  }

  // TODO: 실제 구현 시 trackEvents.soundAssetId 기반으로 sound_assets 조회
  return {
    project,
    trackGroups,
    tracks,
    trackEvents,
    soundAssets: buildMockSoundAssets(),
  };
}
