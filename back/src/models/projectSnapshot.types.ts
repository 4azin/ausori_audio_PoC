/** ProjectSnapshot 엔티티 타입 정의 */
export interface ProjectSnapshot {
  id: number;
  projectId: number;
  version: number;
  snapshot: SnapshotPayload;
  createdAt: Date;
}

/** 스냅샷 JSON 페이로드 — load 응답과 동일한 nested 구조 */
export interface SnapshotPayload {
  version: number;
  trackGroups: SnapshotGroup[];
}

export interface SnapshotGroup {
  id: number;
  type: "ambience" | "cinematic" | "dialogue_vo" | "foley" | "sfx" | "music";
  volume: number;
  isMuted: boolean;
  isSolo: boolean;
  order: number;
  tracks: SnapshotTrack[];
}

export interface SnapshotTrack {
  id: number;
  name: string;
  volume: number;
  pan: number;
  isMuted: boolean;
  isSolo: boolean;
  order: number;
  events: SnapshotEvent[];
}

export interface SnapshotEvent {
  id: number;
  soundAssetId: number;
  aiEventId: number | null;
  startTime: number;
  endTime: number;
  offset: number;
  volumeOverride: number;
  fadeIn: number;
  fadeOut: number;
  isUserEdited: boolean;
}
