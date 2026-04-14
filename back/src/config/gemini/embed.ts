import { EmbedTask, getGeminiClient } from "./client";

/** 장면 설명 → query 임베딩 (검색 시 사용) */
export async function embedQuery(text: string): Promise<number[]> {
  return getGeminiClient().embedOne(text, "query");
}

/** 에셋 메타 텍스트 → document 임베딩 (색인 시 사용) */
export async function embedDocument(text: string): Promise<number[]> {
  return getGeminiClient().embedOne(text, "document");
}

/** 배치 — task 지정 필요. SDK가 한 번에 여러 개 지원 */
export async function embedTexts(
  texts: string[],
  task: EmbedTask,
): Promise<number[][]> {
  return getGeminiClient().embedBatch(texts, task);
}
