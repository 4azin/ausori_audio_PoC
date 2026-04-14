import { MatchedScene, PlacedEvent } from "./types";

/**
 * Scene 타임라인에 에셋을 배치.
 * - scene.endTime - scene.startTime 이 asset.duration보다 길면: 이벤트는 에셋 길이만큼만, 뒤에 페이드아웃
 * - 짧으면: offset=0, endTime=scene.endTime으로 컷
 * - fadeIn/fadeOut 기본값: 0.2s (지나치게 짧은 씬은 0)
 */
export function placeEvent(match: MatchedScene): PlacedEvent {
  const sceneLen = match.scene.endTime - match.scene.startTime;
  const assetDur = match.asset.duration;

  const usedLen = Math.min(sceneLen, assetDur);
  const fade = sceneLen >= 0.5 ? 0.2 : 0;

  return {
    groupType: match.scene.groupType,
    soundAssetId: match.asset.id,
    startTime: match.scene.startTime,
    endTime: match.scene.startTime + usedLen,
    offset: 0,
    volumeOverride: 100,
    fadeIn: fade,
    fadeOut: fade,
  };
}
