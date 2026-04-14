/** 프론트 개발용 목 데이터 빌더 — API 명세서 포맷과 동일한 nested 구조 */

export function buildMockStatus(projectId: number) {
  return {
    projectId,
    jobId: `mock-job-${projectId}`,
    status: "ready",
    currentStage: "done",
    progress: 100,
    snapshotVersion: 1,
    updatedAt: new Date().toISOString(),
  };
}

export function buildMockSoundAssets() {
  return {
    101: {
      id: 101,
      fileName: "rain_ambience.mp3",
      s3Key: "sounds/library/rain_ambience.mp3",
      duration: 30.0,
      format: "mp3" as const,
      channels: 2,
      sampleRate: 48000,
      fileSize: 480000,
    },
    202: {
      id: 202,
      fileName: "door_slam.mp3",
      s3Key: "sounds/library/door_slam.mp3",
      duration: 1.2,
      format: "mp3" as const,
      channels: 1,
      sampleRate: 48000,
      fileSize: 24000,
    },
  };
}

const TRACK_GROUP_TYPES = [
  "ambience",
  "cinematic",
  "dialogue_vo",
  "foley",
  "sfx",
  "music",
] as const;

/** 에디터 로드용 목 스냅샷 — trackGroups > tracks > events 중첩 구조 */
export function buildMockSnapshot(projectId: number) {
  const tracksByGroup: Record<string, unknown[]> = {
    ambience: [
      {
        id: 1,
        name: "Ambience 1",
        volume: 100,
        pan: 0,
        isMuted: false,
        order: 1,
        events: [
          {
            id: 1,
            soundAssetId: 101,
            startTime: 0.0,
            endTime: 15.5,
            offset: 0.0,
            volumeOverride: 80,
            fadeIn: 0.5,
            fadeOut: 1.0,
            isUserEdited: false,
          },
        ],
      },
    ],
    sfx: [
      {
        id: 2,
        name: "SFX 1",
        volume: 100,
        pan: 0,
        isMuted: false,
        order: 1,
        events: [
          {
            id: 2,
            soundAssetId: 202,
            startTime: 3.2,
            endTime: 4.1,
            offset: 0.0,
            volumeOverride: 95,
            fadeIn: 0.0,
            fadeOut: 0.1,
            isUserEdited: false,
          },
        ],
      },
    ],
  };

  const trackGroups = TRACK_GROUP_TYPES.map((type, idx) => ({
    id: idx + 1,
    type,
    volume: 80,
    isMuted: false,
    isSolo: false,
    order: idx + 1,
    tracks: tracksByGroup[type] ?? [],
  }));

  return {
    version: 1,
    trackGroups,
  };
}

/** 프로젝트 상세 + 스냅샷 + soundAssets (GET /:id/load 목 응답) */
export function buildMockProjectDetail(projectId: number) {
  return {
    id: projectId,
    title: `Mock Project ${projectId}`,
    thumbnailUrl: null,
    status: "ready",
    originalVideoUrl: null,
    finalVideoUrl: null,
    durationSeconds: 30,
    snapshot: buildMockSnapshot(projectId),
    soundAssets: buildMockSoundAssets(),
  };
}
