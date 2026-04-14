import { projectModel } from "../../models";

/** 사용자의 프로젝트 목록 조회 (페이지네이션) */
export async function getProjects(
  userId: number,
  page = 1,
  limit = 10,
) {
  const offset = (page - 1) * limit;
  const { rows, total } = await projectModel.findAllByUserId(userId, { limit, offset });
  return { projects: rows, total, page, limit };
}
