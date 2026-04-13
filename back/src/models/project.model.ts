import { Project } from "./project.types";

// TODO: DB 연결 후 실제 쿼리로 교체 (현재 in-memory stub)
const projects: Project[] = [];
let nextId = 1;

/** Project DB 접근 레이어 — 쿼리와 스키마만 담당 */
export const projectModel = {

  /** 사용자의 전체 프로젝트 조회 */
  async findAllByUserId(userId: number): Promise<Project[]> {
    return projects.filter((p) => p.userId === userId);
  },

  /** ID로 프로젝트 단건 조회 */
  async findById(id: number): Promise<Project | undefined> {
    return projects.find((p) => p.id === id);
  },

  /** 프로젝트 생성 */
  async create(data: { userId: number; title: string }): Promise<Project> {
    const project: Project = {
      id: nextId++,
      userId: data.userId,
      title: data.title,
      thumbnailUrl: null,
      status: "uploading",
      originalVideoUrl: null,
      finalVideoUrl: null,
      durationSeconds: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    projects.push(project);
    return project;
  },

  /** 프로젝트 정보 수정 */
  async update(
    id: number,
    data: Partial<{ title: string; status: string }>
  ): Promise<Project | undefined> {
    const project = projects.find((p) => p.id === id);

    if (!project) return undefined;

    if (data.title) project.title = data.title;
    if (data.status) project.status = data.status as Project["status"];
    project.updatedAt = new Date();

    return project;
  },

  /** 프로젝트 삭제 */
  async delete(id: number): Promise<boolean> {
    const index = projects.findIndex((p) => p.id === id);

    if (index === -1) return false;

    projects.splice(index, 1);
    return true;
  },
};
