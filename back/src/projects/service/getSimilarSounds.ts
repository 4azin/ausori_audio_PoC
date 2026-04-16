import {
  projectModel,
  aiEventModel,
  soundAssetModel,
} from "../../models";
import type { SimilarSearchFilter } from "../../models/soundAsset.model";
import { notFoundError, badRequestError } from "../../middleware/customError";

type Level = "major" | "mid" | "sub";

interface SimilarSoundsParams {
  projectId: number;
  userId: number;
  aiEventId?: number;
  soundAssetId?: number;
  level?: Level;
  categoryId?: number;
  limit: number;
  offset: number;
}

export async function getSimilarSounds(params: SimilarSoundsParams) {
  const {
    projectId, userId, aiEventId, soundAssetId,
    level: reqLevel, categoryId, limit, offset,
  } = params;

  // 1. 프로젝트 소유권 검증
  const project = await projectModel.findById(projectId);
  if (!project) throw notFoundError("프로젝트를 찾을 수 없습니다");
  if (project.userId !== userId) throw notFoundError("프로젝트를 찾을 수 없습니다");

  // 2. 임베딩 벡터 결정
  let embedding: number[] | null = null;
  let queryVector: "ai_event" | "sound_asset";
  let resolvedAiEventId: number | undefined;

  if (aiEventId) {
    const aiEvent = await aiEventModel.findById(aiEventId);
    if (!aiEvent) throw notFoundError("AI 이벤트를 찾을 수 없습니다");
    if (aiEvent.projectId !== projectId) throw badRequestError("해당 프로젝트의 이벤트가 아닙니다");

    embedding = await aiEventModel.findEmbeddingById(aiEventId);
    queryVector = "ai_event";
    resolvedAiEventId = aiEventId;
  } else if (soundAssetId) {
    embedding = await soundAssetModel.findEmbeddingById(soundAssetId);
    queryVector = "sound_asset";
  } else {
    throw badRequestError("aiEventId 또는 soundAssetId가 필요합니다");
  }

  if (!embedding) throw notFoundError("임베딩을 찾을 수 없습니다");

  // 3. 카테고리 필터 결정
  const level: Level = reqLevel ?? "sub";
  let filter: SimilarSearchFilter = { level };

  if (categoryId != null) {
    // 명시적 categoryId → 해당 level에 맞게 설정
    if (level === "major") filter.majorId = categoryId;
    else if (level === "mid") filter.midId = categoryId;
    else filter.subId = categoryId;
  }

  // level 상위 ID가 없으면 soundAssetId 기반으로 채움
  if (soundAssetId && (!filter.majorId || !filter.midId)) {
    const cat = await soundAssetModel.findCategoryById(soundAssetId);
    if (cat) {
      if (!filter.majorId) filter.majorId = cat.majorId;
      if (!filter.midId && level !== "major") filter.midId = cat.midId;
      if (!filter.subId && level === "sub") filter.subId = cat.subId;
    }
  }

  filter.excludeId = soundAssetId;

  // 4. 벡터 검색
  const sounds = await soundAssetModel.similarSearch(filter, embedding, limit, offset);

  // 5. 응답 조립
  const resolvedCategoryId =
    level === "major" ? filter.majorId :
    level === "mid" ? filter.midId :
    filter.subId;

  return {
    queryVector,
    ...(resolvedAiEventId != null && { aiEventId: resolvedAiEventId }),
    level,
    categoryId: resolvedCategoryId ?? null,
    sounds,
  };
}
