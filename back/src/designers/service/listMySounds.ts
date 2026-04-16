import { soundAssetModel, soundDesignerModel } from "../../models";
import { notFoundError } from "../../middleware/customError";

export async function listMySounds(
  userId: number,
  opts: { page: number; limit: number },
) {
  const designer = await soundDesignerModel.findByUserId(userId);
  if (!designer) throw notFoundError("디자이너 정보를 찾을 수 없습니다");

  const offset = (opts.page - 1) * opts.limit;
  return soundAssetModel.findAllByDesignerId(designer.id, {
    limit: opts.limit,
    offset,
  });
}
