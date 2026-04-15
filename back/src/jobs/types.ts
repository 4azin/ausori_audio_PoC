/** AI 작업 관련 타입 정의 */

export type JobStatus =
  | "pending"
  | "scene_splitting"
  | "analyzing"
  | "refining_timing"
  | "matching"
  | "placing"
  | "done"
  | "failed";

/**
 * 백엔드가 Redis에 enqueue하는 작업 요청.
 * wire 포맷은 camelCase 통일 — AI(Python) 쪽은 pydantic alias_generator=to_camel 로 수용.
 */
export interface JobRequest {
  jobId: string;
  projectId: number;
  videoPath: string;
}

/** AI 워커가 Redis에 갱신하는 진행 상황 (SET/GET) — camelCase */
export interface JobProgress {
  jobId: string;
  status: JobStatus;
  progress: number;
  currentStage?: string;
  updatedAt?: string;
}

/** AI가 완료 시 Stream으로 발행하는 최종 결과 payload */
export interface JobDoneMessage {
  jobId: string;
  projectId: number;
  result: {
    /**
     * AI 분석이 생성한 이벤트 의도 목록 (description + embedding).
     * 백엔드는 이 목록을 ai_events 에 append-only 로 삽입한 뒤,
     * 각 trackEvents[].aiEventIndex 를 실제 ai_event_id 로 치환한다.
     * 유저 수동 추가 대응은 AI 파이프라인이 만들지 않으므로 여기에 올 일 없음.
     */
    aiEvents: Array<{
      groupType: "ambience" | "cinematic" | "dialogue_vo" | "foley" | "sfx" | "music";
      description: string;
      embedding: number[];
      suggestedStartTime?: number | null;
      suggestedEndTime?: number | null;
    }>;
    trackGroups: Array<{
      type: "ambience" | "cinematic" | "dialogue_vo" | "foley" | "sfx" | "music";
      volume: number;
      isMuted: boolean;
      isSolo: boolean;
      order: number;
    }>;
    tracks: Array<{
      groupIndex: number;
      name: string;
      volume: number;
      pan: number;
      isMuted: boolean;
      isSolo?: boolean;
      order: number;
    }>;
    trackEvents: Array<{
      trackIndex: number;
      /** result.aiEvents 배열에서의 인덱스 (유저 수동 추가 없음 → 항상 존재) */
      aiEventIndex: number;
      soundAssetId: number;
      startTime: number;
      endTime: number;
      offset: number;
      volumeOverride: number;
      fadeIn: number;
      fadeOut: number;
      isUserEdited: boolean;
    }>;
  };
}
