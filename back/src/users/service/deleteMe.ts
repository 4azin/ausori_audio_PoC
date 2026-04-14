import { Session } from "express-session";
import { userModel } from "../../models";
import { notFoundError } from "../../middleware/customError";

/**
 * 회원 탈퇴 — DB에서 유저 삭제 후 세션 파기
 * 순서가 중요: DB 삭제 먼저 → 실패 시 세션은 유지 → 재시도 가능
 */
export async function deleteMe(userId: number, session: Session): Promise<void> {
  const deleted = await userModel.deleteById(userId);

  if (!deleted) throw notFoundError("유저를 찾을 수 없습니다");

  await new Promise<void>((resolve, reject) => {
    session.destroy((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
