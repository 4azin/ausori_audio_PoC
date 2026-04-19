import { apiClient } from "../client";
import { SoundAsset, SoundCategoryNode, SoundSearchQuery } from "@/types/api/sound";
import { PaginationInfo } from "@/types/api/common";
import { delay, mockCategories, mockSoundAssets } from "../mock/data";

const isMock = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

export const soundsApi = {
  getSounds: async (query: SoundSearchQuery): Promise<{ sounds: SoundAsset[] } & PaginationInfo> => {
    if (isMock) {
      await delay(400);
      return {
        sounds: mockSoundAssets,
        total: mockSoundAssets.length,
        page: query.page || 1,
        limit: query.limit || 20,
      };
    }
    
    // 객체를 쿼리스트링으로 변환 (간단한 구현)
    const urlParams = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        urlParams.append(key, value.toString());
      }
    });

    return apiClient<{ sounds: SoundAsset[] } & PaginationInfo>(`/api/sounds?${urlParams.toString()}`);
  },

  getCategories: async (): Promise<SoundCategoryNode[]> => {
    if (isMock) {
      await delay(200);
      return mockCategories;
    }
    return apiClient<SoundCategoryNode[]>("/api/sounds/categories");
  },
};
