/** AI 작업 관련 타입 정의 — wire 포맷은 camelCase 통일 (ai/redis_contract.md 참고). */

import { TrackGroup } from "../models/trackGroup.types";

export type JobStatus =
  | "pending"
  | "scene_splitting"
  | "analyzing"
  | "refining_timing"
  | "matching"
  | "placing"
  | "done"
  | "failed";

export type GroupType = TrackGroup["type"];

export type EnergyLevel = "low" | "medium" | "high";
export type TextureKind = "one_shot" | "continuous" | "loop";

/** 백엔드가 Redis에 enqueue 하는 작업 요청 — `job:request:{jobId}` */
export interface JobRequest {
  jobId: string;
  projectId: number;
  userId: number;
  videoPath: string;          // S3 key (버킷명 제외)
  videoMeta: {
    durationSeconds?: number; // 미지의 경우 생략 가능 (업로드 시점에 모를 수 있음)
    mimeType: string;
    fileSize: number;
  };
  requestedAt: string;        // ISO
}

/** AI 워커가 갱신하는 진행 상황 — `job:progress:{jobId}` */
export interface JobProgress {
  jobId: string;
  projectId?: number;
  status: JobStatus;
  progress: number;           // 0~100
  currentStage?: string;
  message?: string;           // 사용자 노출 가능 메시지 / 실패 시 에러 요약
  updatedAt?: string;         // ISO
}

/**
 * AI가 발행하는 단일 분석 이벤트 (raw 출력).
 * 백엔드는 이 객체를 받아 ai_events INSERT + vector search + track_events 배치를 수행.
 */
export interface AiEventPayload {
  /** track group 분류 */
  track: GroupType;
  /** 자연어 설명 — 임베딩 입력 */
  description: string;
  /** taxonomy 3-depth 경로 (taxonomy.json 원본 표기) */
  categoryPath: [string, string, string];

  startTime: number;          // 초
  endTime: number;            // 초
  peakTime?: number | null;   // foley/sfx hit 정렬용

  mood?: string[];
  energy?: EnergyLevel | null;
  texture?: TextureKind | null;
  tags?: string[];
  confidence: number;         // 0~1

  /**
   * AI 가 미리 계산해 보낸 임베딩(선택). 없으면 백엔드가 description 으로 Gemini 호출.
   * vector(3072) 기준.
   */
  embedding?: number[];
}

/**
 * AI가 완료 시 Stream 으로 발행하는 최종 결과 — `job:done` (XADD field=`data`).
 * trackGroups/tracks/trackEvents 는 AI가 생성하지 않는다 — 백엔드가 events 를 가지고 직접 배치한다.
 */
export interface JobDoneMessage {
  jobId: string;
  projectId: number;
  completedAt: string;        // ISO

  videoSummary?: string | null;
  videoContext?: string | null;

  /** 트랙별로 분기되지 않은 단일 배열. 각 원소의 `track` 으로 그룹 구분. */
  events: AiEventPayload[];

  /** llmUsage / metrics 등 운영 지표 (자유 스키마) */
  telemetry?: unknown;
}
