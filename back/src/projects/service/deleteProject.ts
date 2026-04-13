import { projectModel } from "../../models";

import { notFoundError } from "../../middleware/customError";

/** 프로젝트 삭제 */
export async function deleteProject(id: number): Promise<void> {
  const deleted = await projectModel.delete(id);

  if (!deleted) throw notFoundError("프로젝트를 찾을 수 없습니다");
}
