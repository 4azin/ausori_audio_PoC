import { z } from "zod/v4";

/** 트랙 그룹 저장 스키마 */
const trackGroupSchema = z.object({
  type: z.enum(["ambience", "cinematic", "dialogue_vo", "foley", "sfx", "music"]),
  volume: z.number().int().min(0).max(100),
  isMuted: z.boolean(),
  isSolo: z.boolean(),
  order: z.number().int().min(0),
});

/** 트랙 저장 스키마 */
const trackSchema = z.object({
  groupIndex: z.number().int().min(0),
  name: z.string().min(1).max(100),
  volume: z.number().int().min(0).max(100),
  pan: z.number().int().min(-100).max(100),
  isMuted: z.boolean(),
  isSolo: z.boolean().default(false),
  order: z.number().int().min(0),
});

/** 트랙 이벤트 저장 스키마 */
const trackEventSchema = z.object({
  trackIndex: z.number().int().min(0),
  soundAssetId: z.number().int(),
  /** AI 생성 이벤트면 load 때 받은 값 그대로 round-trip, 유저 수동 추가면 null/생략 */
  aiEventId: z.number().int().nullable().optional(),
  startTime: z.number().min(0),
  endTime: z.number().min(0),
  offset: z.number().min(0),
  volumeOverride: z.number().int().min(0).max(100),
  fadeIn: z.number().min(0),
  fadeOut: z.number().min(0),
  isUserEdited: z.boolean(),
});

/** 프로젝트 에디터 상태 저장 요청 스키마 */
export const saveProjectDto = z.object({
  trackGroups: z.array(trackGroupSchema).min(1),
  tracks: z.array(trackSchema),
  trackEvents: z.array(trackEventSchema),
});

export type SaveProjectDto = z.infer<typeof saveProjectDto>;
