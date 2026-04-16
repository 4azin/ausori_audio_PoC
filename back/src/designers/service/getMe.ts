import { soundDesignerModel } from "../../models";
import { notFoundError } from "../../middleware/customError";

/**
 * 디자이너 프로필 조회 — 기본 정보 + 통계 (사운드 수, 총 다운로드)
 *
 * 쿼리 3회:
 *   1. sound_designers에서 프로필 SELECT
 *   2. sound_assets에서 COUNT (내 에셋 수)
 *   3. sound_assets에서 SUM(download_count) (총 다운로드)
 *   → 2, 3은 Promise.all로 병렬 실행 (응답 속도 개선)
 */
export async function getDesignerMe(userId: number) {
  const designer = await soundDesignerModel.findByUserId(userId);
  if (!designer) throw notFoundError("디자이너 정보를 찾을 수 없습니다");

  // Promise.all: 두 쿼리를 동시에 실행 → 각각 기다리는 것보다 빠름
  const [soundCount, totalDownloads] = await Promise.all([
    soundDesignerModel.getSoundCount(designer.id),
    soundDesignerModel.getTotalDownloads(designer.id),
  ]);

  return { designer, soundCount, totalDownloads };
}
