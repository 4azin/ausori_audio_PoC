/** TrackGroup 엔티티 타입 정의 */
export interface TrackGroup {
  id: number;
  projectId: number;
  type: "ambience" | "cinematic" | "dialogue_vo" | "foley" | "sfx" | "music";
  volume: number;
  isMuted: boolean;
  isSolo: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}
