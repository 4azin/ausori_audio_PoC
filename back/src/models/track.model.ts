import { Track } from "./track.types";

// TODO: DB 연결 후 실제 쿼리로 교체 (현재 in-memory stub)
const tracks: Track[] = [];
let nextId = 1;

/** Track DB 접근 레이어 */
export const trackModel = {

  /** 프로젝트의 전체 트랙 조회 */
  async findAllByProjectId(projectId: number): Promise<Track[]> {
    return tracks.filter((t) => t.projectId === projectId);
  },

  /** 프로젝트의 트랙 일괄 삭제 */
  async deleteAllByProjectId(projectId: number): Promise<void> {
    const ids = tracks
      .filter((t) => t.projectId === projectId)
      .map((t) => t.id);

    for (const id of ids) {
      const idx = tracks.findIndex((t) => t.id === id);
      if (idx !== -1) tracks.splice(idx, 1);
    }
  },

  /** 트랙 일괄 생성 */
  async createMany(
    projectId: number,
    data: Omit<Track, "id" | "projectId" | "createdAt" | "updatedAt">[],
  ): Promise<Track[]> {
    const now = new Date();

    const created = data.map((d) => {
      const track: Track = {
        id: nextId++,
        projectId,
        ...d,
        createdAt: now,
        updatedAt: now,
      };
      tracks.push(track);
      return track;
    });

    return created;
  },
};
