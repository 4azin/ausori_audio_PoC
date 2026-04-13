/** TrackGroup 엔티티 타입 정의 */
export interface TrackGroup {
  id: number;
  projectId: number;
  type: "dialogue" | "music" | "background" | "foley" | "sfx" | "cinematic";
  volume: number;
  isMuted: boolean;
  isSolo: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}
