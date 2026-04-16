import { userModel, soundDesignerModel } from "../../models";
import { conflictError, notFoundError } from "../../middleware/customError";

/**
 * 디자이너 온보딩 — 일반 유저(role: user)를 디자이너(role: designer)로 승격
 *
 * DB 변경 2곳:
 *   1. sound_designers 테이블에 새 레코드 INSERT
 *   2. users 테이블의 role 컬럼을 'designer'로 UPDATE
 *
 * 중복 방지: 이미 sound_designers에 레코드가 있으면 409 CONFLICT
 */
export async function register(userId: number, data: { displayName: string; bio?: string }) {
  // 이미 디자이너로 등록됐는지 확인
  const existing = await soundDesignerModel.findByUserId(userId);
  if (existing) throw conflictError("이미 디자이너로 등록된 사용자입니다");

  // sound_designers 테이블에 새 레코드 생성
  const designer = await soundDesignerModel.create({
    userId,
    displayName: data.displayName,
    bio: data.bio,
  });

  // users 테이블의 role을 'designer'로 변경
  const user = await userModel.updateRoleById(userId, "designer");
  if (!user) throw notFoundError("유저를 찾을 수 없습니다");

  // controller에서 세션에 role 갱신할 수 있도록 role도 함께 반환
  return { designer, role: user.role };
}
