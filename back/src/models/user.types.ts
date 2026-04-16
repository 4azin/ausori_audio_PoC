/** User 엔티티 타입 정의 — ERD users 테이블 기준 */
export interface User {
  id: number;
  email: string;
  name: string;
  profileImageUrl: string | null;
  googleId: string;
  role: "user" | "designer" | "admin";
  plan: "free" | "pro";
  monthlyUsageCount: number;
  createdAt: Date;
  updatedAt: Date;
}
