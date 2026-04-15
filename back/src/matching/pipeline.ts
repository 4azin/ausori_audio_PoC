import { SnapshotPayload } from "../models";
import { embedScenes } from "./embed";
import { buildSnapshotPayload } from "./groupAssignment";
import { placeEvent } from "./placement";
import { searchAssetForScene } from "./search";
import { MatchedScene, PlacedEvent, Scene } from "./types";

/**
 * 매칭 파이프라인 오케스트레이터.
 * scenes[] → embed → vector search → place → groupAssignment → SnapshotPayload
 *
 * 호출 위치: jobs/job.consumer.ts 에서 AI 완료 메시지 수신 후.
 * 현재는 search가 미구현이라 end-to-end 동작 X.
 */
export async function runMatchingPipeline(
  scenes: Scene[],
  version: number,
): Promise<SnapshotPayload> {
  const vectors = await embedScenes(scenes);

  const matched: MatchedScene[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const hit = await searchAssetForScene(scenes[i], vectors[i]);
    if (!hit) continue;
    matched.push({
      scene: scenes[i],
      asset: { id: hit.id, duration: hit.duration },
      similarity: hit.similarity,
    });
  }

  const placed: PlacedEvent[] = matched.map(placeEvent);
  return buildSnapshotPayload(placed, version);
}
