import {
  projectModel,
  projectSnapshotModel,
  trackGroupModel,
  trackModel,
  trackEventModel,
} from "../../models";
import { withTransaction } from "../../config/db";
import { notFoundError } from "../../middleware/customError";

/** 특정 버전의 스냅샷으로 라이브 테이블을 replace (새 버전은 찍지 않음) */
export async function restoreSnapshot(
  projectId: number,
  userId: number,
  version: number,
) {
  const project = await projectModel.findById(projectId);
  if (!project) throw notFoundError("프로젝트를 찾을 수 없습니다");
  if (project.userId !== userId) throw notFoundError("프로젝트를 찾을 수 없습니다");

  const snapshot = await projectSnapshotModel.findByVersion(projectId, version);
  if (!snapshot) throw notFoundError("스냅샷을 찾을 수 없습니다");

  const payload = snapshot.snapshot;

  await withTransaction(async (client) => {
    await trackEventModel.deleteAllByProjectId(projectId, client);
    await trackModel.deleteAllByProjectId(projectId, client);
    await trackGroupModel.deleteAllByProjectId(projectId, client);

    const createdGroups = await trackGroupModel.createMany(
      projectId,
      payload.trackGroups.map((g) => ({
        type: g.type,
        volume: g.volume,
        isMuted: g.isMuted,
        isSolo: g.isSolo,
        order: g.order,
      })),
      client,
    );

    const trackInputs: Array<{
      groupId: number;
      srcEvents: typeof payload.trackGroups[number]["tracks"][number]["events"];
    } & Omit<Parameters<typeof trackModel.createMany>[1][number], "groupId">> = [];

    payload.trackGroups.forEach((g, gi) => {
      for (const t of g.tracks) {
        trackInputs.push({
          groupId: createdGroups[gi].id,
          name: t.name,
          volume: t.volume,
          pan: t.pan,
          isMuted: t.isMuted,
          isSolo: t.isSolo,
          order: t.order,
          srcEvents: t.events,
        });
      }
    });

    const createdTracks = await trackModel.createMany(
      projectId,
      trackInputs.map(({ srcEvents: _s, ...rest }) => rest),
      client,
    );

    const eventInputs: Parameters<typeof trackEventModel.createMany>[1] = [];
    trackInputs.forEach((ti, idx) => {
      for (const e of ti.srcEvents) {
        eventInputs.push({
          trackId: createdTracks[idx].id,
          soundAssetId: e.soundAssetId,
          aiEventId: e.aiEventId ?? null,
          startTime: e.startTime,
          endTime: e.endTime,
          offset: e.offset,
          volumeOverride: e.volumeOverride,
          fadeIn: e.fadeIn,
          fadeOut: e.fadeOut,
          isUserEdited: e.isUserEdited,
        });
      }
    });

    await trackEventModel.createMany(projectId, eventInputs, client);
  });

  return { projectId, restoredVersion: version };
}
