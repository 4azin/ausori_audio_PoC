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

/** SoundAsset 전체 필드 — 디자이너 CRUD용 */
export interface SoundAssetFull extends SoundAsset {
  designerId: number | null;
  originalPath: string | null;
  majorId: number;
  midId: number;
  subId: number;
  mood: string[];
  tags: string[];
  description: string | null;
  bpm: number | null;
  instruments: string[] | null;
  downloadCount: number;
  createdAt: Date;
}
