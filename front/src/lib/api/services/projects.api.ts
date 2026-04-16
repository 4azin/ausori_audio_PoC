import { apiClient } from "../client";
import { Project, ProjectLoadResponse, ProjectSaveRequest } from "@/types/api/project";
import { PaginationInfo } from "@/types/api/common";
import { delay, mockProjectLoadData, mockProjects } from "../mock/data";

const isMock = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

export const projectsApi = {
  getProjects: async (page = 1, limit = 10): Promise<{ projects: Project[] } & PaginationInfo> => {
    if (isMock) {
      await delay(500);
      return {
        projects: mockProjects,
        total: mockProjects.length,
        page,
        limit,
      };
    }
    return apiClient<{ projects: Project[] } & PaginationInfo>(`/api/projects?page=${page}&limit=${limit}`);
  },

  createProject: async (title: string): Promise<Project> => {
    if (isMock) {
      await delay(500);
      return {
        id: 3,
        title,
        status: "uploading",
        thumbnailUrl: "",
        createdAt: new Date().toISOString(),
      };
    }
    return apiClient<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  },

  loadProject: async (id: number): Promise<ProjectLoadResponse> => {
    if (isMock) {
      await delay(800);
      return mockProjectLoadData(id);
    }
    return apiClient<ProjectLoadResponse>(`/api/projects/${id}/load`);
  },

  saveProject: async (id: number, data: ProjectSaveRequest): Promise<{ id: number; version: number; createdAt: string }> => {
    if (isMock) {
      await delay(800);
      return { id, version: 2, createdAt: new Date().toISOString() };
    }
    return apiClient<{ id: number; version: number; createdAt: string }>(`/api/projects/${id}/save`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};
