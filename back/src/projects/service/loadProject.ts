import {
  projectModel,
  trackGroupModel,
  trackModel,
  trackEventModel,
  soundAssetModel,
  projectSnapshotModel,
  SoundAsset,
  TrackGroup,
} from "../../models";
import { notFoundError } from "../../middleware/customError";

/** 프로젝트 생성 시 자동 만들 6 트랙 그룹의 표시 순서 — load 응답에서도 동일 강제 */
const DEFAULT_GROUP_ORDER: TrackGroup["type"][] = [
  "ambience",
  "cinematic",
  "dialogue_vo",
  "foley",
  "sfx",
  "music",
];

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

  // load 응답은 6 트랙 그룹을 항상 순서대로 포함 (스펙 강제). DB에 없는 type 은 빈 그룹으로 보정.
  const groupByType = new Map(groups.map((g) => [g.type, g] as const));
  const trackGroups = DEFAULT_GROUP_ORDER.map((type, idx) => {
    const g = groupByType.get(type);
    return {
      id: g?.id ?? null,
      type,
      volume: g?.volume ?? 100,
      isMuted: g?.isMuted ?? false,
      isSolo: g?.isSolo ?? false,
      order: g?.order ?? idx + 1,
      tracks: (g ? tracksByGroup.get(g.id) ?? [] : []).map((t) => ({
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
        aiEventId: e.aiEventId,
        startTime: e.startTime,
        endTime: e.endTime,
        offset: e.offset,
        volumeOverride: e.volumeOverride,
        fadeIn: e.fadeIn,
        fadeOut: e.fadeOut,
        isUserEdited: e.isUserEdited,
      })),
    })),
    };
  });

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
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    snapshot: {
      version: latestSnapshot?.version ?? 0,
      trackGroups,
    },
    soundAssets,
  };
}
