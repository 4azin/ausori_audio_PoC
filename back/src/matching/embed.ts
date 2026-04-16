import { embedTexts } from "../config/gemini";
import { Scene } from "./types";

/** Scene[] → description 임베딩 (검색용이므로 query task) */
export async function embedScenes(scenes: Scene[]): Promise<number[][]> {
  return embedTexts(
    scenes.map((s) => s.description),
    "query",
  );
}
