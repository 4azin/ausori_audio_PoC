import { TrackGroup } from "./trackGroup.types";

// TODO: DB 연결 후 실제 쿼리로 교체 (현재 in-memory stub)
const trackGroups: TrackGroup[] = [];
let nextId = 1;

/** TrackGroup DB 접근 레이어 */
export const trackGroupModel = {

  /** 프로젝트의 전체 트랙 그룹 조회 */
  async findAllByProjectId(projectId: number): Promise<TrackGroup[]> {
    return trackGroups.filter((g) => g.projectId === projectId);
  },

  /** 프로젝트의 트랙 그룹 일괄 삭제 */
  async deleteAllByProjectId(projectId: number): Promise<void> {
    const ids = trackGroups
      .filter((g) => g.projectId === projectId)
      .map((g) => g.id);

    for (const id of ids) {
      const idx = trackGroups.findIndex((g) => g.id === id);
      if (idx !== -1) trackGroups.splice(idx, 1);
    }
  },

  /** 트랙 그룹 일괄 생성 */
  async createMany(
    projectId: number,
    data: Omit<TrackGroup, "id" | "projectId" | "createdAt" | "updatedAt">[],
  ): Promise<TrackGroup[]> {
    const now = new Date();

    const created = data.map((d) => {
      const group: TrackGroup = {
        id: nextId++,
        projectId,
        ...d,
        createdAt: now,
        updatedAt: now,
      };
      trackGroups.push(group);
      return group;
    });

    return created;
  },
};
