import { TrackEvent } from "./trackEvent.types";

// TODO: DB 연결 후 실제 쿼리로 교체 (현재 in-memory stub)
const trackEvents: TrackEvent[] = [];
let nextId = 1;

/** TrackEvent DB 접근 레이어 */
export const trackEventModel = {

  /** 프로젝트의 전체 트랙 이벤트 조회 */
  async findAllByProjectId(projectId: number): Promise<TrackEvent[]> {
    return trackEvents.filter((e) => e.projectId === projectId);
  },

  /** 프로젝트의 트랙 이벤트 일괄 삭제 */
  async deleteAllByProjectId(projectId: number): Promise<void> {
    const ids = trackEvents
      .filter((e) => e.projectId === projectId)
      .map((e) => e.id);

    for (const id of ids) {
      const idx = trackEvents.findIndex((e) => e.id === id);
      if (idx !== -1) trackEvents.splice(idx, 1);
    }
  },

  /** 트랙 이벤트 일괄 생성 */
  async createMany(
    projectId: number,
    data: Omit<TrackEvent, "id" | "projectId" | "createdAt" | "updatedAt">[],
  ): Promise<TrackEvent[]> {
    const now = new Date();

    const created = data.map((d) => {
      const event: TrackEvent = {
        id: nextId++,
        projectId,
        ...d,
        createdAt: now,
        updatedAt: now,
      };
      trackEvents.push(event);
      return event;
    });

    return created;
  },
};
