export type UserRole = "user" | "admin" | "designer";

export interface User {
  id: number;
  email: string;
  name: string;
  profileImageUrl: string;
  role: UserRole;
  plan: "free" | "pro";
  monthlyUsageCount?: number;
  createdAt?: string;
}

export interface DesignerProfile {
  id: number;
  userId?: number;
  displayName: string;
  bio: string;
  revenueShareRate?: number;
  soundCount?: number;
  totalDownloads?: number;
  role?: string;
  createdAt?: string;
}

export interface AuthCodeRequest {
  code: string;
}
