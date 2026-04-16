import { DesignerProfile } from "./user";

export interface SoundCategory {
  major: string;
  mid: string;
  sub?: string;
}

export interface SoundAsset {
  id: number;
  fileName: string;
  category: SoundCategory;
  mood?: string[];
  tags?: string[];
  description?: string;
  duration: number;
  format: string;
  fileSize?: number;
  downloadCount?: number;
  designer?: DesignerProfile | null;
  // load() 시 반환 값
  s3Key?: string;
  channels?: number;
  sampleRate?: number;
}

export interface SoundCategoryNode {
  id: number;
  name: string;
  children?: SoundCategoryNode[];
}

export interface SoundSearchQuery {
  majorId?: string;
  midId?: string;
  subId?: string;
  mood?: string;
  q?: string;
  page?: number;
  limit?: number;
}
