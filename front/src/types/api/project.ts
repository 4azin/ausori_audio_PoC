import { SoundAsset } from "./sound";

export type ProjectStatus = "ready" | "uploading" | "analyzing" | "failed";

export interface Project {
  id: number;
  title: string;
  thumbnailUrl: string;
  status: ProjectStatus;
  originalVideoUrl?: string;
  durationSeconds?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ProjectStatusResponse {
  projectId: number;
  jobId: string;
  status: ProjectStatus;
  currentStage: string;
  progress: number;
  snapshotVersion: number;
  updatedAt: string;
}

export interface TrackEvent {
  id?: number;
  soundAssetId: number;
  startTime: number;
  endTime: number;
  offset: number;
  volumeOverride: number;
  fadeIn: number;
  fadeOut: number;
  isUserEdited: boolean;
  trackIndex?: number; // 저장 시 참조용
}

export interface Track {
  id?: number;
  name: string;
  volume: number;
  pan: number;
  isMuted: boolean;
  isSolo: boolean;
  order: number;
  events?: TrackEvent[];
  groupIndex?: number; // 저장 시 참조용
}

export type TrackGroupType = "ambience" | "cinematic" | "dialogue_vo" | "foley" | "sfx" | "music";

export interface TrackGroup {
  id?: number;
  type: TrackGroupType;
  volume: number;
  isMuted: boolean;
  isSolo: boolean;
  order: number;
  tracks?: Track[];
}

export interface ProjectSnapshot {
  version: number;
  trackGroups: TrackGroup[];
}

export interface ProjectSaveRequest {
  trackGroups: TrackGroup[];
  tracks: Track[];
  trackEvents: TrackEvent[];
}

export interface ProjectLoadResponse extends Project {
  snapshot: ProjectSnapshot;
  soundAssets: Record<string, SoundAsset>;
}
