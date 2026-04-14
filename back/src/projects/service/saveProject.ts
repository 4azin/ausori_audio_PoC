import {
  projectModel,
  trackGroupModel,
  trackModel,
  trackEventModel,
  projectSnapshotModel,
  SnapshotPayload,
} from "../../models";
import { withTransaction } from "../../config/db";
import { notFoundError, badRequestError } from "../../middleware/customError";
import { SaveProjectDto } from "../dto";

/** 에디터 저장 — 라이브 테이블 replace + project_snapshots 새 버전 기록 */
export async function saveProject(
  projectId: number,
  userId: number,
  data: SaveProjectDto,
) {
  const project = await projectModel.findById(projectId);
  if (!project) throw notFoundError("프로젝트를 찾을 수 없습니다");
  if (project.userId !== userId) throw notFoundError("프로젝트를 찾을 수 없습니다");

  // index 참조 유효성 검증
  for (const t of data.tracks) {
    if (t.groupIndex < 0 || t.groupIndex >= data.trackGroups.length) {
      throw badRequestError(`tracks[].groupIndex가 범위를 벗어났습니다: ${t.groupIndex}`);
    }
  }
  for (const e of data.trackEvents) {
    if (e.trackIndex < 0 || e.trackIndex >= data.tracks.length) {
      throw badRequestError(`trackEvents[].trackIndex가 범위를 벗어났습니다: ${e.trackIndex}`);
    }
  }

  return withTransaction(async (client) => {
    await trackEventModel.deleteAllByProjectId(projectId, client);
    await trackModel.deleteAllByProjectId(projectId, client);
    await trackGroupModel.deleteAllByProjectId(projectId, client);

    const createdGroups = await trackGroupModel.createMany(
      projectId,
      data.trackGroups.map((g) => ({
        type: g.type,
        volume: g.volume,
        isMuted: g.isMuted,
        isSolo: g.isSolo,
        order: g.order,
      })),
      client,
    );

    const createdTracks = await trackModel.createMany(
      projectId,
      data.tracks.map((t) => ({
        groupId: createdGroups[t.groupIndex].id,
        name: t.name,
        volume: t.volume,
        pan: t.pan,
        isMuted: t.isMuted,
        isSolo: t.isSolo,
        order: t.order,
      })),
      client,
    );

    const createdEvents = await trackEventModel.createMany(
      projectId,
      data.trackEvents.map((e) => ({
        trackId: createdTracks[e.trackIndex].id,
        soundAssetId: e.soundAssetId,
        startTime: e.startTime,
        endTime: e.endTime,
        offset: e.offset,
        volumeOverride: e.volumeOverride,
        fadeIn: e.fadeIn,
        fadeOut: e.fadeOut,
        isUserEdited: e.isUserEdited,
      })),
      client,
    );

    const version = await projectSnapshotModel.nextVersion(projectId, client);

    const eventsByTrack = new Map<number, typeof createdEvents>();
    for (const e of createdEvents) {
      const arr = eventsByTrack.get(e.trackId) ?? [];
      arr.push(e);
      eventsByTrack.set(e.trackId, arr);
    }
    const tracksByGroup = new Map<number, typeof createdTracks>();
    for (const t of createdTracks) {
      const arr = tracksByGroup.get(t.groupId) ?? [];
      arr.push(t);
      tracksByGroup.set(t.groupId, arr);
    }

    const payload: SnapshotPayload = {
      version,
      trackGroups: createdGroups.map((g) => ({
        id: g.id,
        type: g.type,
        volume: g.volume,
        isMuted: g.isMuted,
        isSolo: g.isSolo,
        order: g.order,
        tracks: (tracksByGroup.get(g.id) ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          volume: t.volume,
          pan: t.pan,
          isMuted: t.isMuted,
          isSolo: t.isSolo,
          order: t.order,
          events: (eventsByTrack.get(t.id) ?? []).map((e) => ({
            id: e.id,
            soundAssetId: e.soundAssetId,
            startTime: e.startTime,
            endTime: e.endTime,
            offset: e.offset,
            volumeOverride: e.volumeOverride,
            fadeIn: e.fadeIn,
            fadeOut: e.fadeOut,
            isUserEdited: e.isUserEdited,
          })),
        })),
      })),
    };

    const snapshot = await projectSnapshotModel.create(projectId, version, payload, client);

    return {
      id: snapshot.id,
      version: snapshot.version,
      createdAt: snapshot.createdAt,
    };
  });
}
