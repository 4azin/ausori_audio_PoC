/** 프론트 개발용 목 데이터 빌더 — 실제 AI/DB 연동 전까지 사용 */

/** 분석 완료 상태 고정 반환 */
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

/** 프로젝트에서 쓰이는 sound_assets 목 맵 (재생용 메타 포함) */
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

/** 6개 대분류 트랙 그룹 — 프로젝트 생성 시 자동 생성되는 고정 그룹 */
const TRACK_GROUP_TYPES = [
  "ambience",
  "cinematic",
  "dialogue_vo",
  "foley",
  "sfx",
  "music",
] as const;

/** 에디터 초기 로드용 목 스냅샷 (AI 분석 완료 가정) */
export function buildMockSnapshot(projectId: number) {
  const now = new Date();

  const trackGroups = TRACK_GROUP_TYPES.map((type, idx) => ({
    id: idx + 1,
    projectId,
    type,
    volume: 80,
    isMuted: false,
    isSolo: false,
    order: idx + 1,
    createdAt: now,
    updatedAt: now,
  }));

  return {
    trackGroups,
    tracks: [
      {
        id: 1,
        projectId,
        groupId: 1,
        name: "Ambience 1",
        volume: 100,
        pan: 0,
        isMuted: false,
        order: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        projectId,
        groupId: 5,
        name: "SFX 1",
        volume: 100,
        pan: 0,
        isMuted: false,
        order: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
    trackEvents: [
      {
        id: 1,
        projectId,
        trackId: 1,
        soundAssetId: 101,
        startTime: 0.0,
        endTime: 15.5,
        offset: 0.0,
        volumeOverride: 80,
        fadeIn: 0.5,
        fadeOut: 1.0,
        isUserEdited: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        projectId,
        trackId: 2,
        soundAssetId: 202,
        startTime: 3.2,
        endTime: 4.1,
        offset: 0.0,
        volumeOverride: 95,
        fadeIn: 0.0,
        fadeOut: 0.1,
        isUserEdited: false,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}
