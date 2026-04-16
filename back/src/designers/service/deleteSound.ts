import { soundAssetModel, soundDesignerModel } from "../../models";
import { notFoundError, forbiddenError } from "../../middleware/customError";

export async function deleteSound(userId: number, soundId: number) {
  const designer = await soundDesignerModel.findByUserId(userId);
  if (!designer) throw notFoundError("디자이너 정보를 찾을 수 없습니다");

  const sound = await soundAssetModel.findById(soundId);
  if (!sound) throw notFoundError("사운드를 찾을 수 없습니다");
  if (sound.designerId !== designer.id) throw forbiddenError("본인의 에셋만 삭제할 수 있습니다");

  // TODO: S3에서 파일 삭제
  const deleted = await soundAssetModel.deleteById(soundId);
  if (!deleted) throw notFoundError("사운드를 찾을 수 없습니다");
}
