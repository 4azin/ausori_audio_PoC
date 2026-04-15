# Redis 통신 계약 (Backend ↔ AI Worker)

백엔드(Node/TS)와 AI 워커(Python) 사이의 Redis 키/스트림 계약을 정의한다.
샘플 파이프라인 출력은 `back/0415_1_김선태_pipeline_result.json` 참고.

---

## 0. 전역 규칙

### 0-1. Wire 포맷 = **camelCase** 통일
- 모든 JSON 필드는 camelCase.
- Python 측은 `pydantic.ConfigDict(alias_generator=to_camel, populate_by_name=True)` 한 번 선언으로 대응.
- 내부 Python 변수명은 snake_case 자유. wire만 맞추면 됨.

### 0-2. 시간 단위 = **초(float)**
- 모든 시간 필드는 초 단위 float. `1.5`, `13.0`, `0.773`.
- 현재 파이프라인 샘플에서 `foley`가 ms로 보이는 건 잘못. 초로 통일.

### 0-3. ID 타입
- `jobId`: string(UUID v4)
- `projectId`: **number(int)** — 절대 string으로 내보내지 말 것
- `userId`: number(int)
- `aiEventId`: number(int) — AI가 부여 안 함. 백엔드가 DB INSERT 후 할당.

### 0-4. Enum 값
- `trackGroupType`: `"ambience" | "cinematic" | "dialogue_vo" | "foley" | "sfx" | "music"` (소문자/snake)
  - AI의 `track` 필드(`"ambience"`, `"sfx"` 등)가 이에 해당.
- `status`: `"pending" | "scene_splitting" | "analyzing" | "refining_timing" | "matching" | "placing" | "done" | "failed"`

### 0-5. 카테고리
- `categoryPath`: 3-depth 배열 `[major, mid, sub]`, **taxonomy.json 원본 표기** (예: `["Ambience", "Urban", "Street"]`, `["SFX", "Cartoon", "Pop"]`).
- DB FK 매핑(백엔드 책임): `ai/taxonomy.json` → `category_major/mid/sub` 테이블 id.
- 매칭 실패 시 → 해당 이벤트는 스킵/로그, 파이프라인은 계속.

---

## 1. Keys / Streams 일람

| 키 / 스트림 | 타입 | 방향 | 페이로드 |
|---|---|---|---|
| `job:request:{jobId}` | STRING | 백엔드 → AI | [§2 JobRequest](#2-jobrequest-백엔드--ai) |
| `project:job:{projectId}` | STRING | 백엔드 → 백엔드 | `{jobId}` (plain string) |
| `job:progress:{jobId}` | STRING | AI → 백엔드 | [§3 JobProgress](#3-jobprogress-ai--백엔드) |
| `job:done` | STREAM | AI → 백엔드 | [§4 JobDoneMessage](#4-jobdonemessage-ai--백엔드) — XADD 1 entry = 1 job |

Consumer group: `backend` (백엔드가 `XREADGROUP`).
XADD field name: `data` (JSON 문자열 전체를 담음).

---

## 2. JobRequest (백엔드 → AI)

영상 업로드 완료 후 백엔드가 분석 요청으로 enqueue.

```jsonc
{
  "jobId":     "550e8400-e29b-41d4-a716-446655440000",
  "projectId": 42,
  "userId":    17,
  "videoPath": "videos/42/550e8400.mp4",
  "videoMeta": {
    "durationSeconds": 180.5,
    "mimeType":        "video/mp4",
    "fileSize":        15728640
  },
  "requestedAt": "2026-04-15T03:55:12.000Z"
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `jobId` | string(UUID) | 이 분석 세션의 고유 ID. 이후 모든 통신 키의 suffix. |
| `projectId` | int | 백엔드 `projects.id`. DB 반영 시 사용. |
| `userId` | int | 소유자. 학습 데이터/감사 로그용. |
| `videoPath` | string | **S3 key** (버킷명 제외). 워커는 `AWS_S3_BUCKET + videoPath`로 다운로드. |
| `videoMeta.durationSeconds` | float | 영상 길이(초). 파이프라인 가드레일용. |
| `videoMeta.mimeType` | string | MIME. `video/mp4` 등. |
| `videoMeta.fileSize` | int | 바이트. |
| `requestedAt` | ISO string | 요청 시각 (UTC). |

> **추가 예정 필드(논의)**: `priority`(free/pro plan 차등), `presetPreference`(브이로그/시네마틱 등).

---

## 3. JobProgress (AI → 백엔드)

단계 전이마다 AI가 SET으로 갱신. 백엔드는 `GET /api/projects/:id/status` 응답 구성에 사용.

```jsonc
{
  "jobId":        "550e8400-...",
  "projectId":    42,
  "status":       "analyzing",
  "progress":     35,
  "currentStage": "analyzing_soft",
  "message":      "Scene 3/8 분석 중",
  "updatedAt":    "2026-04-15T03:56:01.000Z"
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `jobId` | string | |
| `projectId` | int | (옵션이지만 포함 권장: 백엔드 역참조 편의) |
| `status` | enum | 위 §0-4 |
| `progress` | int 0–100 | 전체 진행률 |
| `currentStage` | string | 내부 세부 스테이지 이름 (예: `preprocessing`, `analyzing_soft`, `analyzing_hard`, `matching`) |
| `message` | string? | 선택 — UI 표시용 상세. 에러 시 에러 요약 담아도 됨. |
| `updatedAt` | ISO string | |

실패 시: `status: "failed"`, `message`에 사용자 노출 가능한 에러 메시지.

---

## 4. JobDoneMessage (AI → 백엔드)

파이프라인이 최종 완료 시 `XADD job:done * data <JSON>` 으로 1건 발행.

### 4-1. 전체 구조

```jsonc
{
  "jobId":     "550e8400-...",
  "projectId": 42,
  "completedAt": "2026-04-15T04:01:33.000Z",

  "videoSummary": "충주맨 김선태가 유튜브 골드버튼을 목에 걸고 ...",
  "videoContext": "충주시 홍보맨 김선태가 100만 구독자 달성 기념으로 ...",

  "events": [ /* §4-2 AiEvent[] — 모든 트랙을 단일 배열로 통합 */ ],

  "telemetry": {                 // 선택, 백엔드는 로깅만
    "sceneCount": 8,
    "llmUsage": { "calls": 17, "prompt": 681162, "output": 14346 },
    "metrics":  { /* 자유 스키마 */ }
  }
}
```

- **단일 `events[]` 배열로 통일**. 현재 샘플처럼 `foley/ambience/music/…` 6개로 분산하면 소비자가 case마다 분기해야 해서 불리. track 구분은 각 event의 `track` 필드로.
- `trackGroups / tracks / trackEvents` 를 AI가 생성하지 않는다. **AI는 raw 분석 이벤트만 내놓고**, 백엔드가 (1) description 임베딩 생성, (2) vector search로 soundAssetId 선정, (3) track_groups/tracks/track_events 로 배치한다. 기존 `JobDoneMessage` 의 trackGroups/tracks/trackEvents 필드는 **제거** (백엔드 내부 로직으로 이관).

### 4-2. AiEvent 단일 스키마

```jsonc
{
  "track":         "foley",
  "description":   "목에 걸린 얇은 스트랩 줄을 한 손으로 쥐고 가볍게 당기며 발생하는 마찰음.",
  "categoryPath": ["Foley", "Material_Texture", "Friction"],

  "startTime":     9.5,
  "endTime":       10.5,
  "peakTime":      10.0,              // optional — hard 트랙(foley/sfx)만 유의미

  "mood":          ["차분함"],
  "energy":        "low",             // "low" | "medium" | "high" | null
  "texture":       "one_shot",        // "one_shot" | "continuous" | "loop" | null
  "tags":          ["Material_Texture:Friction"],

  "confidence":    0.7
}
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `track` | enum | ✓ | 대분류 그룹 (§0-4) |
| `description` | string | ✓ | 자연어 묘사 — 백엔드가 임베딩 생성 후 vector search에 사용 |
| `categoryPath` | string[3] | ✓ | taxonomy 경로. 3-depth 강제. 매칭 실패 시 해당 이벤트는 스킵. |
| `startTime` | float(초) | ✓ | |
| `endTime` | float(초) | ✓ | `> startTime` |
| `peakTime` | float(초) | ◯ | foley/sfx 임팩트 정렬용. 생략 가능. |
| `mood` | string[] | ◯ | 자유 태그. 빈 배열 허용. |
| `energy` | enum? | ◯ | 위 3종 중 하나 또는 null |
| `texture` | enum? | ◯ | 위 3종 중 하나 또는 null |
| `tags` | string[] | ◯ | `"Major:Sub"` 형태 권장. 빈 배열 허용. |
| `confidence` | float 0~1 | ✓ | AI 자기 확신. 백엔드가 임계치 이하 이벤트 스킵 가능. |

### 4-3. 현재 샘플 대비 변경 요약

| 현재 `0415_1_*.json` | 계약 변경 |
|---|---|
| top-level에 `foley / ambience / music / cinematic / sfx / dialogue_vo` 6배열 | **단일 `events[]` 로 통합**. 각 원소의 `track` 필드로 구분 |
| foley: `event_id`, `peak_time`, `event_category`, `event_tags` (snake, ms 단위 의심) | `peakTime`, tags 로 통일. **초 단위 float**. `event_id` 제거 (의미 없음, 재사용됨) |
| non-foley: `track`, `category_path` (snake, list) | `track`, `categoryPath` (camel) |
| `video_summary`, `video_context`, `llm_usage`, `metrics` (snake) | `videoSummary`, `videoContext`, `telemetry.llmUsage`, `telemetry.metrics` (camel) |
| **jobId/projectId 누락** | **필수 추가**. 백엔드가 Redis 키(`{jobId}`)로도 매칭하지만, 페이로드에도 id를 포함해 역참조/로그를 단순화 |
| `completedAt` 누락 | 추가 (지표/감사) |

### 4-4. 백엔드 처리 흐름 (참고)

```
1. XREADGROUP job:done → JobDoneMessage
2. for each event:
     - embedding = GeminiEmbeddings.embed(event.description)
     - ai_events INSERT (project_id, groupType=event.track, description, embedding,
                        suggestedStartTime, suggestedEndTime, analysis_batch)
3. for each event (placement):
     - soundAssetId = vectorSearch(embedding, filter by categoryPath)
     - track_events INSERT (ai_event_id, sound_asset_id, start/end, …)
4. track_groups / tracks 는 project 기본 6그룹 유지 or 필요 시 생성
5. project_snapshots INSERT (JSONB), projects.status = "ready"
6. XACK, job:* 키 cleanup
```

---

## 5. 에러 처리

- AI 파이프라인 실패 → `JobProgress` 로 `status: "failed"` 설정 + `message` 채우기. `job:done` 은 **발행하지 않음**.
- 백엔드가 `JobDoneMessage` 처리 중 DB 오류 → XACK 하지 않고 consumer group에 pending 상태로 남김. 재시도 정책은 추후.
- malformed JSON → 백엔드가 dead-letter 로 옮기고 `job:progress:{jobId}.status = "failed"` 로 표시.

---

## 6. 확정 전 미결 사항

- [ ] AI가 **영상 전체 프레임 추출**이 끝나기 전 `JobProgress` 세분화 스테이지 목록 확정
- [ ] `peakTime`이 foley 외에도 유용한가 (SFX hit 계열도 필요할 수도)
- [ ] embedding을 **AI가 생성**할지 **백엔드가 생성**할지 — 현재 샘플엔 embedding 없음. 계약상 백엔드 생성으로 가정. 반대로 AI가 만들면 `embedding: float[3072]` 를 AiEvent에 추가하고 백엔드는 단순 INSERT.
- [ ] `confidence` 임계치 (백엔드가 얼마 이하를 drop할지)
- [ ] 유료/무료 플랜별 분석 품질 차등 파라미터 (JobRequest.priority)

---

## 부록 A. Python pydantic 예시

```python
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

class _Base(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

class AiEvent(_Base):
    track: str
    description: str
    category_path: list[str]
    start_time: float
    end_time: float
    peak_time: float | None = None
    mood: list[str] = []
    energy: str | None = None
    texture: str | None = None
    tags: list[str] = []
    confidence: float

class JobDoneMessage(_Base):
    job_id: str
    project_id: int
    completed_at: str
    video_summary: str
    video_context: str
    events: list[AiEvent]
    telemetry: dict | None = None

# 발행
import json, redis
r = redis.Redis(...)
payload = JobDoneMessage(...).model_dump(by_alias=True)  # ← camelCase JSON
r.xadd("job:done", {"data": json.dumps(payload, ensure_ascii=False)})
```

---

## 부록 B. AI 측 구현 결정 (2026-04-15 추가)

계약 §6 미결 항목 중 AI 워커 내부에서 확정 가능한 부분을 정리한다. 변경/이의 있으면 알려달라.

- **Redis 키 수명**: AI 는 `job:request` / `job:progress` 를 **삭제하지 않는다**. TTL 설정과 소비 후 DEL 은 백엔드 책임. AI 는 SET(progress) / XADD(done) 만 수행.
- **실패 경로**: 파이프라인 예외 시 `job:progress:{jobId}.status = "failed"` + `message` 에 에러 요약만 남기고 **`job:done` 은 발행하지 않는다** (§5 준수).
- **`currentStage` 값 고정**:
  - `preprocessing` — S3 다운로드/프레임 추출
  - `global_scene_split` — global analyzer (status=`scene_splitting`)
  - `analyzing_hard` — foley analyzer (status=`analyzing`)
  - `analyzing_soft` — non-foley analyzer (status=`analyzing`)
  - `done` — 최종 (status=`done`)
  - `matching` / `placing` / `refining_timing` 은 백엔드 단계이므로 AI 는 갱신하지 않음.
- **시간 단위**: foley 포함 모든 이벤트의 `startTime / endTime / peakTime` 은 **초(float)**. 프롬프트 스키마에 단위를 명시하고 파이프라인 후처리에서 변환하지 않는다.
- **`confidence`**: AI 는 필터링 없이 그대로 방출. 임계치 기반 drop 은 백엔드.
- **`job:done` consumer group**: `backend` 는 백엔드가 선 생성한다고 가정. AI 는 `XADD job:done * data <json>` 만.
- **`ai_event_id` / `embedding`**: AI 는 부여/생성하지 않는다 (§4-2, §6 가정 준수).
