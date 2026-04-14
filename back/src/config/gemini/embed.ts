import { getGeminiClient } from "./client";

/** 장면 설명 텍스트 → 3072차원 임베딩 벡터 */
export async function embedText(text: string): Promise<number[]> {
  const client = getGeminiClient();
  return client.embedContent(text);
}

/** 배치 임베딩 — 병렬 호출 (rate limit은 client 레이어에서 처리) */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(embedText));
}
