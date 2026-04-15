import { TrackGroup } from "./trackGroup.types";

/** AiEvent 엔티티 타입 정의 — AI 분석이 생성한 이벤트 의도 (append-only 자산) */
export interface AiEvent {
  id: number;
  projectId: number;
  analysisId: number | null;
  groupType: TrackGroup["type"];
  description: string;
  /**
   * pgvector는 텍스트 리터럴로 쓰고 파싱된 number[] 로 읽는다.
   * 일반 SELECT(BASE_COLUMNS)에는 포함되지 않으므로 optional.
   * embedding 이 필요한 경우 aiEventModel.findEmbeddingById 로 별도 조회.
   */
  embedding?: number[];
  suggestedStartTime: number | null;
  suggestedEndTime: number | null;
  analysisBatch: number;
  createdAt: Date;
}
