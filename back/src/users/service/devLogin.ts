import { userModel, User } from "../../models";

/**
 * 개발용 임시 로그인 — Google OAuth 없이 email/name으로 유저 생성/조회
 * production에서는 절대 사용 금지 (라우터에서 NODE_ENV로 차단)
 */
export async function devLogin(email: string, name: string): Promise<User> {
  return userModel.upsertByGoogleId({
    googleId: `dev_${email}`,
    email,
    name,
    profileImageUrl: null,
  });
}
