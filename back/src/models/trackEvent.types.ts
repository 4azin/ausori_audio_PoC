/** TrackEvent 엔티티 타입 정의 */
export interface TrackEvent {
  id: number;
  projectId: number;
  trackId: number;
  soundAssetId: number;
  startTime: number;
  endTime: number;
  offset: number;
  volumeOverride: number;
  fadeIn: number;
  fadeOut: number;
  isUserEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}
