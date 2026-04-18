import type { JobDoneMessage } from "../../src/jobs";

/**
 * 정상 케이스 — 2개 트랙(ambience, sfx)에 이벤트 배치.
 * projectId는 테스트 시점에 동적으로 주입해야 하므로 함수로 제공.
 */
export function normalJobDone(projectId: number): JobDoneMessage {
  return {
    jobId: "test-job-normal",
    projectId,
    completedAt: new Date().toISOString(),
    videoSummary: "도시 풍경을 담은 짧은 영상. 비 오는 거리와 카페 내부.",
    videoContext: "감성적인 분위기의 브이로그 영상",
    events: [
      {
        track: "ambience",
        description: "부드러운 빗소리가 창문을 두드리는 소리",
        categoryPath: ["Ambience", "Weather", "Rain"],
        startTime: 0,
        endTime: 15,
        mood: ["calm", "peaceful"],
        energy: "low",
        texture: "continuous",
        tags: ["rain", "window", "indoor"],
        confidence: 0.92,
      },
      {
        track: "ambience",
        description: "카페 내부 잔잔한 소음과 커피 머신 소리",
        categoryPath: ["Ambience", "Interior", "Cafe"],
        startTime: 15,
        endTime: 30,
        mood: ["warm", "cozy"],
        energy: "low",
        texture: "continuous",
        tags: ["cafe", "chatter", "coffee"],
        confidence: 0.88,
      },
      {
        track: "sfx",
        description: "커피잔을 테이블에 내려놓는 소리",
        categoryPath: ["SFX", "Household", "Cup"],
        startTime: 20,
        endTime: 21,
        peakTime: 20.3,
        energy: "medium",
        texture: "one_shot",
        tags: ["cup", "table", "ceramic"],
        confidence: 0.85,
      },
      {
        track: "foley",
        description: "우산을 펼치는 소리",
        categoryPath: ["Foley", "Props", "Umbrella"],
        startTime: 3,
        endTime: 4.5,
        peakTime: 3.2,
        energy: "medium",
        texture: "one_shot",
        tags: ["umbrella", "open"],
        confidence: 0.78,
      },
    ],
    telemetry: {
      llmUsage: { promptTokens: 1500, completionTokens: 800 },
      processingTimeMs: 12345,
    },
  };
}

/**
 * 카테고리 불일치 케이스 — 존재하지 않는 카테고리 경로.
 * enrichEvent에서 카테고리 해석 실패 → soundAssetId = null → track_events에 안 들어감.
 * ai_events에는 여전히 저장되어야 함.
 */
export function mismatchCategoryJobDone(projectId: number): JobDoneMessage {
  return {
    jobId: "test-job-mismatch",
    projectId,
    completedAt: new Date().toISOString(),
    videoSummary: "카테고리 불일치 테스트",
    events: [
      {
        track: "ambience",
        description: "존재하지 않는 카테고리의 소리",
        categoryPath: ["NonExistent", "Invalid", "Category"],
        startTime: 0,
        endTime: 5,
        confidence: 0.9,
      },
    ],
  };
}

/**
 * 빈 이벤트 케이스 — 이벤트가 0개.
 * track_groups 6개는 생성되지만 tracks/track_events는 비어야 함.
 */
export function emptyEventsJobDone(projectId: number): JobDoneMessage {
  return {
    jobId: "test-job-empty",
    projectId,
    completedAt: new Date().toISOString(),
    videoSummary: "무음 영상",
    videoContext: "소리가 거의 없는 타임랩스 영상",
    events: [],
  };
}

/**
 * 다중 트랙 케이스 — 6개 트랙 전부 사용.
 */
export function allTracksJobDone(projectId: number): JobDoneMessage {
  return {
    jobId: "test-job-all-tracks",
    projectId,
    completedAt: new Date().toISOString(),
    videoSummary: "모든 트랙 타입을 사용하는 영상",
    events: [
      {
        track: "ambience",
        description: "바람 소리",
        categoryPath: ["Ambience", "Weather", "Wind"],
        startTime: 0, endTime: 10,
        confidence: 0.9,
      },
      {
        track: "cinematic",
        description: "긴장감 있는 저음 드론",
        categoryPath: ["Cinematic", "Drone", "Dark"],
        startTime: 0, endTime: 15,
        confidence: 0.85,
      },
      {
        track: "dialogue_vo",
        description: "내레이션 보이스오버",
        categoryPath: ["Dialogue_VO", "Narration", "Male"],
        startTime: 5, endTime: 12,
        confidence: 0.7,
      },
      {
        track: "foley",
        description: "발걸음 소리",
        categoryPath: ["Foley", "Footsteps", "Concrete"],
        startTime: 2, endTime: 8,
        confidence: 0.88,
      },
      {
        track: "sfx",
        description: "문 여닫는 소리",
        categoryPath: ["SFX", "Household", "Door"],
        startTime: 10, endTime: 11,
        confidence: 0.82,
      },
      {
        track: "music",
        description: "잔잔한 피아노 배경음악",
        categoryPath: ["Music", "Instrument", "Piano"],
        startTime: 0, endTime: 30,
        confidence: 0.75,
      },
    ],
  };
}
