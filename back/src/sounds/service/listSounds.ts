/**
 * GET /api/sounds — 카테고리 필터 기반 에셋 목록.
 * TODO: soundAsset.model 에 list/paginate 메서드 추가 후 구현.
 */
export async function listSounds(_filter: {
  majorId?: number;
  midId?: number;
  subId?: number;
  page: number;
  limit: number;
}) {
  throw new Error("[sounds.list] not implemented");
}
