import { TrackGroup } from "./trackGroup.types";

/** AiEvent 엔티티 타입 정의 — AI 분석이 생성한 이벤트 의도 (append-only 자산) */
export interface AiEvent {
  id: number;
  projectId: number;
  groupType: TrackGroup["type"];
  description: string;
  /** pgvector는 텍스트 리터럴로 쿼리하므로 쓸 때는 string, 읽을 땐 파싱된 number[] */
  embedding: number[];
  suggestedStartTime: number | null;
  suggestedEndTime: number | null;
  analysisBatch: number;
  createdAt: Date;
}
