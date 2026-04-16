import { soundDesignerModel } from "../../models";
import { notFoundError } from "../../middleware/customError";

export async function updateDesignerMe(
  userId: number,
  data: Partial<{ displayName: string; bio: string }>,
) {
  const designer = await soundDesignerModel.updateByUserId(userId, data);
  if (!designer) throw notFoundError("디자이너 정보를 찾을 수 없습니다");

  return designer;
}
