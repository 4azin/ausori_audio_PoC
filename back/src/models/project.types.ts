/** Project 엔티티 타입 정의 */
export interface Project {
  id: number;
  userId: number;
  title: string;
  thumbnailUrl: string | null;
  status: "uploading" | "analyzing" | "ready" | "rendering" | "done" | "failed";
  originalVideoUrl: string | null;
  finalVideoUrl: string | null;
  durationSeconds: number | null;
  createdAt: Date;
  updatedAt: Date;
}
