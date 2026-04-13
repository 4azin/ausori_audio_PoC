/** AI 작업 요청 — Redis에 넣을 데이터 */
export interface JobRequest {
  job_id: string;
  project_id: string;
  video_path: string;
}

/** AI 작업 진행 상태 */
export type JobStatus =
  | "pending"
  | "scene_splitting"
  | "analyzing"
  | "refining_timing"
  | "matching"
  | "placing"
  | "done"
  | "failed";

/** AI 작업 진행 상황 — Redis에서 받을 데이터 */
export interface JobProgress {
  job_id: string;
  status: JobStatus;
  progress: number;
}
