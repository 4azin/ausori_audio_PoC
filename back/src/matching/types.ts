/**
 * 매칭 파이프라인 내부 타입.
 * AI → 백엔드 계약 (JobDoneMessage.scenes) shape은 아직 확정 전.
 * Scene 타입은 실제 계약 확정 시 jobs/types.ts와 동기화 필요.
 */

export type TrackGroupType =
  | "ambience"
  | "cinematic"
  | "dialogue_vo"
  | "foley"
  | "sfx"
  | "music";

/** AI가 분석해서 넘겨준 장면 단위 입력 */
export interface Scene {
  startTime: number;
  endTime: number;
  description: string;
  category: {
    majorId: number;
    midId: number;
    subId?: number;
  };
  /** category_major.name == trackGroup type이라는 가정 */
  groupType: TrackGroupType;
  mood?: string[];
}

/** 벡터 검색으로 선택된 에셋 + scene 매칭 결과 */
export interface MatchedScene {
  scene: Scene;
  asset: {
    id: number;
    duration: number;
  };
  similarity: number;
}

/** 배치된 trackEvent — soundAssetId 기준 그룹핑 전 중간 표현 */
export interface PlacedEvent {
  groupType: TrackGroupType;
  soundAssetId: number;
  startTime: number;
  endTime: number;
  offset: number;
  volumeOverride: number;
  fadeIn: number;
  fadeOut: number;
}
