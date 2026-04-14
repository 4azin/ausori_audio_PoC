import { PlacedEvent, TrackGroupType } from "./types";
import { SnapshotPayload } from "../models";

/**
 * PlacedEvent[] → SnapshotPayload.
 * 규칙:
 *   - 같은 groupType 안에서 같은 soundAssetId는 같은 track에 쌓는다
 *   - 같은 track 내 시간 겹침 발생 시 새 track 분리
 *   - 6개 트랙 그룹은 항상 순서대로 생성 (빈 그룹도 포함)
 */
const GROUP_ORDER: TrackGroupType[] = [
  "ambience",
  "cinematic",
  "dialogue_vo",
  "foley",
  "sfx",
  "music",
];

export function buildSnapshotPayload(
  events: PlacedEvent[],
  version: number,
): SnapshotPayload {
  // TODO: 실제 배치 로직 — 현재는 shape만 맞춘 skeleton
  void events;
  return {
    version,
    trackGroups: GROUP_ORDER.map((type, idx) => ({
      id: 0,
      type,
      volume: 100,
      isMuted: false,
      isSolo: false,
      order: idx + 1,
      tracks: [],
    })),
  };
}
