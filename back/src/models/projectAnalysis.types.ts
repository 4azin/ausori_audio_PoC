/** ProjectAnalysis 엔티티 타입 정의 — AI 분석 리포트 원본 보관 */
export interface ProjectAnalysis {
  id: number;
  projectId: number;
  jobId: string;
  analysisBatch: number;
  videoSummary: string | null;
  videoContext: string | null;
  rawPayload: unknown;            // JSONB — JobDoneMessage 원본
  telemetry: unknown | null;      // JSONB — llmUsage / metrics
  completedAt: Date;
  createdAt: Date;
}

/** 목록용 슬림 뷰 — raw_payload / telemetry 제외 + eventCount 집계 */
export interface ProjectAnalysisSummary {
  id: number;
  jobId: string;
  analysisBatch: number;
  videoSummary: string | null;
  videoContext: string | null;
  eventCount: number;
  completedAt: Date;
  createdAt: Date;
}
