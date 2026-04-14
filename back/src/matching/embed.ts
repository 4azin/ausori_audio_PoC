import { embedTexts } from "../config/gemini";
import { Scene } from "./types";

/** Scene[] → 각 description의 임베딩 벡터 배열 (인덱스 대응) */
export async function embedScenes(scenes: Scene[]): Promise<number[][]> {
  return embedTexts(scenes.map((s) => s.description));
}
