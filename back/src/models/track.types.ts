/** Track 엔티티 타입 정의 */
export interface Track {
  id: number;
  projectId: number;
  groupId: number;
  name: string;
  volume: number;
  pan: number;
  isMuted: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}
