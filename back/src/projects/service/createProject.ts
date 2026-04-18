import { projectModel, Project } from "../../models";
import { query } from "../../config/db";
import { CustomError } from "../../middleware/customError";

const FREE_PLAN_MONTHLY_LIMIT = 3;

/** 프로젝트 생성 — free plan 월 3개 제한 적용 */
export async function createProject(userId: number, title: string): Promise<Project> {
  const userRes = await query<{ plan: "free" | "pro" }>(
    `SELECT plan FROM users WHERE id = $1`,
    [userId],
  );
  const plan = userRes.rows[0]?.plan ?? "free";

  if (plan === "free") {
    const count = await projectModel.countThisMonth(userId);
    if (count >= FREE_PLAN_MONTHLY_LIMIT) {
      throw new CustomError(
        429,
        `무료 플랜은 월 ${FREE_PLAN_MONTHLY_LIMIT}개까지 생성 가능합니다`,
        "RATE_LIMIT",
      );
    }
  }

  return projectModel.create({ userId, title });
}
