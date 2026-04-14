import {
  projectModel,
  trackGroupModel,
  trackModel,
  trackEventModel,
} from "../../models";
import { notFoundError } from "../../middleware/customError";
import { SaveProjectDto } from "../dto";

/** 프로젝트 에디터 상태 일괄 저장 */
export async function saveProject(
  projectId: number,
  userId: string,
  data: SaveProjectDto,
) {
  const project = await projectModel.findById(projectId);

  if (!project) throw notFoundError("프로젝트를 찾을 수 없습니다");
  if (project.userId !== userId) throw notFoundError("프로젝트를 찾을 수 없습니다");

  /** 기존 데이터 삭제 후 재생성 (replace 전략) */
  await trackEventModel.deleteAllByProjectId(projectId);
  await trackModel.deleteAllByProjectId(projectId);
  await trackGroupModel.deleteAllByProjectId(projectId);

  /** 트랙 그룹 생성 */
  const createdGroups = await trackGroupModel.createMany(projectId, data.trackGroups);

  /** 트랙 생성 — groupIndex → 실제 groupId 매핑 */
  const tracksWithGroupId = data.tracks.map((t) => ({
    groupId: createdGroups[t.groupIndex].id,
    name: t.name,
    volume: t.volume,
    pan: t.pan,
    isMuted: t.isMuted,
    order: t.order,
  }));

  const createdTracks = await trackModel.createMany(projectId, tracksWithGroupId);

  /** 트랙 이벤트 생성 — trackIndex → 실제 trackId 매핑 */
  const eventsWithTrackId = data.trackEvents.map((e) => ({
    trackId: createdTracks[e.trackIndex].id,
    soundAssetId: e.soundAssetId,
    startTime: e.startTime,
    endTime: e.endTime,
    offset: e.offset,
    volumeOverride: e.volumeOverride,
    fadeIn: e.fadeIn,
    fadeOut: e.fadeOut,
    isUserEdited: e.isUserEdited,
  }));

  await trackEventModel.createMany(projectId, eventsWithTrackId);

  return { message: "저장 완료" };
}
