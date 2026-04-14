/** AI 작업 관련 타입 정의 */

export type JobStatus =
  | "pending"
  | "scene_splitting"
  | "analyzing"
  | "refining_timing"
  | "matching"
  | "placing"
  | "done"
  | "failed";

/** 백엔드가 Redis에 enqueue하는 작업 요청 */
export interface JobRequest {
  job_id: string;
  project_id: string;
  video_path: string;
}

/** AI 워커가 Redis에 갱신하는 진행 상황 (SET/GET) */
export interface JobProgress {
  job_id: string;
  status: JobStatus;
  progress: number;
  currentStage?: string;
  updatedAt?: string;
}

/** AI가 완료 시 Stream으로 발행하는 최종 결과 payload */
export interface JobDoneMessage {
  jobId: string;
  projectId: number;
  result: {
    trackGroups: Array<{
      type: "ambience" | "cinematic" | "dialogue_vo" | "foley" | "sfx" | "music";
      volume: number;
      isMuted: boolean;
      isSolo: boolean;
      order: number;
    }>;
    tracks: Array<{
      groupIndex: number;
      name: string;
      volume: number;
      pan: number;
      isMuted: boolean;
      order: number;
    }>;
    trackEvents: Array<{
      trackIndex: number;
      soundAssetId: number;
      startTime: number;
      endTime: number;
      offset: number;
      volumeOverride: number;
      fadeIn: number;
      fadeOut: number;
      isUserEdited: boolean;
    }>;
  };
}
