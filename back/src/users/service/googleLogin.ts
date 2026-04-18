import { userModel, User } from "../../models";
import { internalError } from "../../middleware/customError";

/** Google OAuth token 교환 응답 타입 */
interface GoogleTokenResponse {
  access_token: string;
}

/** Google userinfo API 응답 타입 */
interface GoogleUserInfo {
  id: string;           // googleId
  email: string;
  name: string;
  picture: string | null;
}

/**
 * Google authorization code → 유저 정보 교환 → DB upsert
 *
 * 흐름:
 * 1. code를 Google token endpoint에 보내서 access_token 획득
 * 2. access_token으로 Google userinfo 조회
 * 3. DB에 upsert (최초 로그인이면 생성, 재로그인이면 갱신)
 */
export async function googleLogin(code: string): Promise<User> {
  const accessToken = await exchangeCodeForToken(code);
  const googleUser = await fetchGoogleUserInfo(accessToken);

  return userModel.upsertByGoogleId({
    googleId: googleUser.id,
    email: googleUser.email,
    name: googleUser.name,
    profileImageUrl: googleUser.picture,
  });
}

/** authorization code → access_token 교환 */
async function exchangeCodeForToken(code: string): Promise<string> {
  const params = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    throw internalError("Google 토큰 교환에 실패했습니다");
  }

  const data = (await response.json()) as GoogleTokenResponse;
  return data.access_token;
}

/** access_token → Google 유저 정보 조회 */
async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw internalError("Google 유저 정보 조회에 실패했습니다");
  }

  return response.json() as Promise<GoogleUserInfo>;
}
