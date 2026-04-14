import { Scene } from "./types";

/**
 * 카테고리 필터 + 코사인 유사도로 top-1 에셋 검색.
 * TODO: models/soundAsset.model.ts에 vectorSearch 추가 후 구현.
 *
 * 쿼리 스케치:
 *   SELECT id, duration, 1 - (embedding <=> $queryVec) AS similarity
 *   FROM sound_assets
 *   WHERE major_id = $1 AND mid_id = $2
 *     AND ($3::bigint IS NULL OR sub_id = $3)
 *   ORDER BY embedding <=> $queryVec
 *   LIMIT 1
 */
export async function searchAssetForScene(
  _scene: Scene,
  _queryVec: number[],
): Promise<{ id: number; duration: number; similarity: number } | null> {
  throw new Error("[matching.search] not implemented");
}
