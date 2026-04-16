import { soundAssetModel, soundDesignerModel } from "../../models";
import { notFoundError, forbiddenError } from "../../middleware/customError";

/**
 * 사운드 에셋 메타데이터 수정
 *
 * 소유권 검증 흐름:
 *   1. userId → sound_designers에서 내 designer.id 조회
 *   2. soundId → sound_assets에서 해당 에셋 조회
 *   3. sound.designerId === designer.id 인지 비교
 *      → 불일치하면 403 FORBIDDEN (다른 디자이너의 에셋)
 *   4. 검증 통과 후 UPDATE 실행
 */
export async function updateSound(
  userId: number,
  soundId: number,
  data: Partial<{ tags: string[]; description: string; mood: string[] }>,
) {
  // 내 디자이너 정보 조회
  const designer = await soundDesignerModel.findByUserId(userId);
  if (!designer) throw notFoundError("디자이너 정보를 찾을 수 없습니다");

  // 수정 대상 사운드 조회
  const sound = await soundAssetModel.findById(soundId);
  if (!sound) throw notFoundError("사운드를 찾을 수 없습니다");

  // 소유권 검증 — 본인이 올린 에셋만 수정 가능
  if (sound.designerId !== designer.id) throw forbiddenError("본인의 에셋만 수정할 수 있습니다");

  return soundAssetModel.updateById(soundId, data);
}
