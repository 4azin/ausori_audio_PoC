/** SoundAsset 엔티티 타입 정의 — 재생에 필요한 오디오 메타 */
export interface SoundAsset {
  id: number;
  fileName: string;
  s3Key: string;
  duration: number;
  format: "mp3" | "ogg" | "wav" | "aif";
  channels: number;
  sampleRate: number;
  fileSize: number;
}
