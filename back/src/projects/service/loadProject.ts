import {
  projectModel,
  trackGroupModel,
  trackModel,
  trackEventModel,
  soundAssetModel,
  projectSnapshotModel,
  SoundAsset,
} from "../../models";
import { notFoundError } from "../../middleware/customError";

/** 에디터 로드 — 프로젝트 메타 + 최신 스냅샷(nested) + soundAssets 맵 */
export async function loadProject(projectId: number, userId: number) {
  const project = await projectModel.findById(projectId);
  if (!project) throw notFoundError("프로젝트를 찾을 수 없습니다");
  if (project.userId !== userId) throw notFoundError("프로젝트를 찾을 수 없습니다");

  const [groups, tracks, events, latestSnapshot] = await Promise.all([
    trackGroupModel.findAllByProjectId(projectId),
    trackModel.findAllByProjectId(projectId),
    trackEventModel.findAllByProjectId(projectId),
    projectSnapshotModel.findLatest(projectId),
  ]);

  const eventsByTrack = new Map<number, typeof events>();
  for (const e of events) {
    const arr = eventsByTrack.get(e.trackId) ?? [];
    arr.push(e);
    eventsByTrack.set(e.trackId, arr);
  }

  const tracksByGroup = new Map<number, typeof tracks>();
  for (const t of tracks) {
    const arr = tracksByGroup.get(t.groupId) ?? [];
    arr.push(t);
    tracksByGroup.set(t.groupId, arr);
  }

  const trackGroups = groups.map((g) => ({
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
  }));

  // soundAssets 맵 구성 — 참조 중인 asset만 batch 조회
  const assetIds = Array.from(new Set(events.map((e) => e.soundAssetId)));
  const assets = await soundAssetModel.findPlaybackByIds(assetIds);
  const soundAssets: Record<number, SoundAsset> = {};
  for (const a of assets) soundAssets[a.id] = a;

  return {
    id: project.id,
    title: project.title,
    thumbnailUrl: project.thumbnailUrl,
    status: project.status,
    originalVideoUrl: project.originalVideoUrl,
    durationSeconds: project.durationSeconds,
    snapshot: {
      version: latestSnapshot?.version ?? 0,
      trackGroups,
    },
    soundAssets,
  };
}
