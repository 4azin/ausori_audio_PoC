import { apiClient } from "../client";
import { AuthCodeRequest, DesignerProfile, User } from "@/types/api/user";
import { delay, mockDesignerProfile, mockUser } from "../mock/data";

const isMock = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

export const authApi = {
  login: async (req: AuthCodeRequest): Promise<User> => {
    if (isMock) {
      await delay(500);
      return mockUser; // 세션 쿠키 대신 즉시 User 반환 (목업)
    }
    return apiClient<User>("/api/users/google", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  logout: async (): Promise<null> => {
    if (isMock) {
      await delay(300);
      return null;
    }
    return apiClient<null>("/api/users/logout", {
      method: "POST",
    });
  },

  getMe: async (): Promise<User> => {
    if (isMock) {
      await delay(300);
      return mockUser;
    }
    return apiClient<User>("/api/users/me");
  },

  registerDesigner: async (body: { displayName: string; bio: string }): Promise<DesignerProfile> => {
    if (isMock) {
      await delay(500);
      return mockDesignerProfile;
    }
    return apiClient<DesignerProfile>("/api/designers/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
