# API 명세서

## 문서 상태

- 이 문서는 `03_erd.md`를 기준으로 정리한 **목표 계약 문서**다.
- 현재 백엔드 구현 현황을 설명하는 문서가 아니라, 앞으로 구현이 맞춰가야 할 public API 계약을 정의한다.
- `payments`, `subscriptions`, `asset_purchases` 등 결제 도메인은 아직 ERD에 반영되지 않았으므로 본 명세에서 제외한다.
- AI 서버와의 내부 통신은 HTTP callback이 아니라 **Redis job contract**를 기준으로 한다.

---

## 설계 원칙

### 인증 방식
- **세션 기반** (express-session + Redis)
- 로그인 후 서버가 세션 ID를 쿠키(`connect.sid`)로 발급
- 이후 모든 요청은 쿠키가 자동으로 붙어서 전송 — 별도 헤더 불필요
- `isAuthenticated` 미들웨어로 세션 검증

### 권한 계층
```
admin    ← 모든 권한
designer ← 사운드 에셋 업로드, 마켓플레이스 판매
user     ← 프로젝트 생성, 영상 편집
```

사운드 디자이너 온보딩이 완료되면 `user → designer`로 role이 격상된다.

### URL 구조
```
/api/users         ← 로그인/로그아웃 + 내 계정 관리
/api/designers     ← 사운드 디자이너 온보딩 + 판매자 관리
/api/projects      ← 프로젝트 (업로드, 분석, 진행률, 스냅샷)
/api/sounds        ← 효과음 검색/조회
/api/marketplace   ← 마켓플레이스
```

### 응답 형식
```json
// 성공
{ "success": true, "data": { ... } }

// 실패
{ "success": false, "error": { "code": "ERROR_CODE", "message": "설명" } }
```

### 에러 코드
| HTTP | code | 설명 |
|------|------|------|
| 400 | VALIDATION_ERROR | 요청 값 유효성 오류 |
| 401 | UNAUTHORIZED | 로그인 필요 |
| 403 | FORBIDDEN | 권한 없음 (role 부족) |
| 404 | NOT_FOUND | 리소스 없음 |
| 409 | CONFLICT | 이미 존재하거나 현재 상태에서 처리 불가 |
| 429 | RATE_LIMIT | 요청 한도 초과 |
| 500 | INTERNAL_ERROR | 서버 오류 |

### 핵심 제약
- 무료 플랜(`plan=free`)은 월 최대 3개 프로젝트만 생성할 수 있다.
- `sound_assets.designer_id`가 `null`이면 기본 라이브러리 에셋이며, 이 경우 public sound API의 `designer` 필드는 `null`이다.
- `originalPath`는 디자이너 업로드 자산의 원본 폴더 복원용 메타데이터다. 저장은 하지만 `/api/sounds`, `/api/marketplace` 같은 public 조회 API에는 노출하지 않는다.
- `embedding` 같은 내부 필드는 public API에 노출하지 않는다.

---

## 1. 사용자 (Users)

### POST /api/users/google
Google OAuth 로그인 / 신규 회원가입

**Request Body**
```json
{ "code": "google_authorization_code" }
```

**Response 200** — 세션 쿠키 자동 발급
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@gmail.com",
    "name": "홍길동",
    "profileImageUrl": "https://...",
    "role": "user",
    "plan": "free"
  }
}
```

---

### POST /api/users/logout
로그아웃 — 서버 세션 파기

**인증 필요**: 로그인 상태

**Response 200**
```json
{ "success": true, "data": null }
```

---

### GET /api/users/me
세션 확인 + 내 프로필 조회

**인증 필요**: 로그인 상태

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@gmail.com",
    "name": "홍길동",
    "profileImageUrl": "https://...",
    "role": "user",
    "plan": "free",
    "monthlyUsageCount": 1,
    "createdAt": "2026-04-13T00:00:00Z"
  }
}
```

**Response 401** — 비로그인
```json
{ "success": false, "error": { "code": "UNAUTHORIZED", "message": "로그인이 필요합니다" } }
```

---

### PATCH /api/users/me
내 프로필 수정

**인증 필요**: 로그인 상태

**Request Body** (수정할 항목만)
```json
{ "name": "새 닉네임" }
```

**Response 200**
```json
{ "success": true, "data": { "id": 1, "name": "새 닉네임" } }
```

---

### DELETE /api/users/me
회원 탈퇴 — 세션 파기 + 계정 삭제

**인증 필요**: 로그인 상태

**Response 200**
```json
{ "success": true, "data": null }
```

---

## 2. 사운드 디자이너 (Designers)

### POST /api/designers/register
사운드 디자이너 온보딩 — `users.role`을 `designer`로 승격하고 `sound_designers` 레코드를 생성

**인증 필요**: role: user

**Request Body**
```json
{
  "displayName": "Sound Studio A",
  "bio": "영화/광고 전문 사운드 디자이너입니다."
}
```

**Response 201**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "userId": 1,
    "displayName": "Sound Studio A",
    "bio": "...",
    "revenueShareRate": 0.7,
    "role": "designer",
    "createdAt": "2026-04-13T00:00:00Z"
  }
}
```

**Response 409** — 이미 디자이너 등록된 사용자
```json
{ "success": false, "error": { "code": "CONFLICT", "message": "이미 디자이너로 등록된 사용자입니다" } }
```

중복 호출이 발생해도 `users.role`과 `sound_designers` 레코드는 한 번만 반영된다.

---

### GET /api/designers/me
내 디자이너 프로필 조회

**인증 필요**: role: designer

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "displayName": "Sound Studio A",
    "bio": "...",
    "revenueShareRate": 0.7,
    "soundCount": 42,
    "totalDownloads": 1500
  }
}
```

---

### PATCH /api/designers/me
내 디자이너 프로필 수정

**인증 필요**: role: designer

**Request Body**
```json
{
  "displayName": "New Studio Name",
  "bio": "새 소개글"
}
```

**Response 200**
```json
{ "success": true, "data": { "id": 1, "displayName": "New Studio Name", "bio": "새 소개글" } }
```

---

### GET /api/designers/me/sounds
내가 업로드한 사운드 에셋 목록

**인증 필요**: role: designer

**Query Parameters**
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| page | number | 페이지 번호 (기본값: 1) |
| limit | number | 페이지당 개수 (기본값: 20) |

**Response 200**
```json
{
  "success": true,
  "data": {
    "sounds": [
      {
        "id": 1,
        "fileName": "rain_heavy_01.wav",
        "category": { "major": "ambience", "mid": "weather", "sub": "rain" },
        "duration": 30.5,
        "format": "wav",
        "downloadCount": 120,
        "createdAt": "2026-04-13T00:00:00Z"
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20
  }
}
```

---

### POST /api/designers/me/sounds
사운드 에셋 업로드

**인증 필요**: role: designer  
**Content-Type**: `multipart/form-data`

**Request Body**
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| file | File | ✓ | 오디오 파일 (`mp3`, `ogg`, `wav`) |
| originalPath | string | | 업로드 시점 원본 폴더 경로. 디자이너 자산 관리용 메타데이터로 저장 |
| majorId | string | ✓ | 대분류 UUID |
| midId | string | ✓ | 중분류 UUID |
| subId | string | | 소분류 UUID (선택) |
| mood | string[] | | 분위기 태그 (`calm`, `tense` 등) |
| tags | string[] | ✓ | 검색용 태그 |
| description | string | | 설명 |
| bpm | number | | BPM (음악만) |
| instruments | string[] | | 악기 목록 (음악만) |

**Response 201**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "fileName": "rain_heavy_01.wav",
    "s3Key": "sounds/designer-uuid/rain_heavy_01.wav",
    "originalPath": "Pack_A/Weather/rain_heavy_01.wav",
    "duration": 30.5,
    "format": "wav",
    "fileSize": 1234567
  }
}
```

`originalPath`는 업로드 시 저장되지만 public sound API에는 노출하지 않는다.

---

### PATCH /api/designers/me/sounds/:soundId
사운드 에셋 메타데이터 수정

**인증 필요**: role: designer (본인 에셋만)

**Request Body**
```json
{
  "tags": ["rain", "outdoor", "heavy"],
  "description": "수정된 설명",
  "mood": ["dark", "dramatic"]
}
```

**Response 200**
```json
{ "success": true, "data": { "id": 1 } }
```

---

### DELETE /api/designers/me/sounds/:soundId
사운드 에셋 삭제

**인증 필요**: role: designer (본인 에셋만)

**Response 200**
```json
{ "success": true, "data": null }
```

---

## 3. 프로젝트 (Projects)

에디터 내 모든 작업(트랙 그룹, 트랙, 이벤트)은 `snapshots`으로 통째로 저장한다.  
개별 트랙/이벤트 단위 public API는 두지 않는다.

### GET /api/projects
내 프로젝트 목록

**인증 필요**: 로그인 상태

**Query Parameters**
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| page | number | 페이지 번호 (기본값: 1) |
| limit | number | 페이지당 개수 (기본값: 10) |

**Response 200**
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": 1,
        "title": "내 첫 번째 영상",
        "thumbnailUrl": "https://...",
        "status": "ready",
        "durationSeconds": 120,
        "createdAt": "2026-04-13T00:00:00Z",
        "updatedAt": "2026-04-13T00:00:00Z"
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 10
  }
}
```

---

### POST /api/projects
새 프로젝트 생성 (메타데이터만, 영상은 별도 업로드)

**인증 필요**: 로그인 상태  
**Content-Type**: `application/json`

**Request Body**
```json
{ "title": "내 첫 번째 영상" }
```

**Response 201**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "내 첫 번째 영상",
    "status": "uploading",
    "createdAt": "2026-04-13T00:00:00Z"
  }
}
```

---

### POST /api/projects/:id/video
프로젝트에 영상 업로드 — S3에 저장하고 AI 분석 작업을 enqueue한다.

**인증 필요**: 로그인 상태 (본인 프로젝트)  
**Content-Type**: `multipart/form-data`  
**최대 크기**: 500MB  
**허용 MIME**: `video/mp4`, `video/webm`, `video/quicktime`

**Request Body**
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| file | File | ✓ | 영상 파일 |

**Response 202**
```json
{
  "success": true,
  "data": {
    "projectId": 1,
    "jobId": "job_abc123",
    "status": "analyzing",
    "s3Key": "videos/{projectId}/{uuid}.mp4"
  }
}
```

업로드 완료 후 자동으로 AI 분석이 enqueue되므로 별도의 분석 요청 API는 없다. 진행 상태는 `GET /api/projects/:id/status` 폴링으로 확인한다.

---

### GET /api/projects/:id
프로젝트 메타 정보 조회 (스냅샷 제외)

**인증 필요**: 로그인 상태 (본인 프로젝트)

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "내 첫 번째 영상",
    "thumbnailUrl": "https://...",
    "status": "ready",
    "originalVideoUrl": "https://...",
    "durationSeconds": 120,
    "createdAt": "2026-04-13T00:00:00Z",
    "updatedAt": "2026-04-13T02:00:00Z"
  }
}
```

스냅샷 및 사운드 에셋을 포함한 에디터 로드 응답은 `GET /:id/load` 참고.

---

### GET /api/projects/:id/load
에디터 로드 — 프로젝트 메타 + 최신 스냅샷(trackGroups > tracks > events 중첩) + 재생용 sound_assets 맵

**인증 필요**: 로그인 상태 (본인 프로젝트)

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "내 첫 번째 영상",
    "thumbnailUrl": "https://...",
    "status": "ready",
    "originalVideoUrl": "https://...",
    "durationSeconds": 120,
    "snapshot": {
      "version": 3,
      "trackGroups": [
        {
          "id": 1,
          "type": "ambience",
          "volume": 80,
          "isMuted": false,
          "isSolo": false,
          "order": 1,
          "tracks": [
            {
              "id": 1,
              "name": "Ambience 1",
              "volume": 100,
              "pan": 0,
              "isMuted": false,
              "isSolo": false,
              "order": 1,
              "events": [
                {
                  "id": 1,
                  "soundAssetId": 101,
                  "aiEventId": 42,
                  "startTime": 0.0,
                  "endTime": 15.5,
                  "offset": 0.0,
                  "volumeOverride": 80,
                  "fadeIn": 0.5,
                  "fadeOut": 1.0,
                  "isUserEdited": false
                }
              ]
            }
          ]
        }
      ]
    },
    "soundAssets": {
      "101": {
        "id": 101,
        "fileName": "rain_ambience.mp3",
        "s3Key": "sounds/library/rain_ambience.mp3",
        "duration": 30.0,
        "format": "mp3",
        "channels": 2,
        "sampleRate": 48000,
        "fileSize": 480000
      }
    }
  }
}
```

**`trackGroups` 반환 규칙**
- 프로젝트 생성 시 6개 대분류 그룹(`ambience | cinematic | dialogue_vo | foley | sfx | music`)이 자동 생성된다. (분류 체계는 `ai/taxonomy.json` 기준)
- 응답의 `trackGroups`는 **항상 6개가 순서대로 포함**된다 (`order` 기준 정렬).

**`soundAssets` 맵**
- 현재 스냅샷에서 참조되는 `soundAssetId`에 해당하는 재생 메타데이터를 key-value 형태로 inline 반환해 N+1 요청을 방지한다.

**`aiEventId`**
- AI 분석 파이프라인이 생성한 이벤트(의도 + embedding)와의 역참조.
- `null`이면 유저가 수동으로 추가한 클립이다.
- 프론트는 이 값을 save 요청에 **그대로 round-trip**해 보존해야 한다. 이후 "이 클립과 유사한 사운드 찾기" API(`/api/sounds/:id/similar?trackEventId=…`)가 이 id를 역참조해 원 의도 기반 벡터 검색을 수행한다.

---

### GET /api/projects/:id/status
프로젝트 비동기 작업 상태 조회 — AI 분석/렌더 진행률 확인용

**인증 필요**: 로그인 상태 (본인 프로젝트)

`currentStage`는 Redis worker의 세부 상태를 그대로 반영한다.

가능한 값:
`pending | scene_splitting | analyzing | refining_timing | matching | placing | done | failed`

**Response 200**
```json
{
  "success": true,
  "data": {
    "projectId": 1,
    "jobId": "job_abc123",
    "status": "analyzing",
    "currentStage": "matching",
    "progress": 75,
    "snapshotVersion": 3,
    "updatedAt": "2026-04-13T00:12:00Z"
  }
}
```

분석이 끝나면 `status`는 `ready`, `progress`는 `100`이 된다.

---

### PATCH /api/projects/:id
프로젝트 제목 수정

**인증 필요**: 로그인 상태 (본인 프로젝트)

**Request Body**
```json
{ "title": "새 제목" }
```

**Response 200**
```json
{ "success": true, "data": { "id": 1, "title": "새 제목" } }
```

---

### DELETE /api/projects/:id
프로젝트 삭제

**인증 필요**: 로그인 상태 (본인 프로젝트)

**Response 200**
```json
{ "success": true, "data": null }
```

---

### POST /api/projects/:id/save
에디터 저장 — 현재 전체 상태를 스냅샷으로 저장하고 새 버전을 발급한다. trackGroups/tracks/trackEvents는 index 기반 참조(`groupIndex`, `trackIndex`)로 전달한다.

**인증 필요**: 로그인 상태 (본인 프로젝트)

**Request Body**
```json
{
  "trackGroups": [
    {
      "type": "ambience",
      "volume": 80,
      "isMuted": false,
      "isSolo": false,
      "order": 1
    }
  ],
  "tracks": [
    {
      "groupIndex": 0,
      "name": "Ambience 1",
      "volume": 100,
      "pan": 0,
      "isMuted": false,
      "isSolo": false,
      "order": 1
    }
  ],
  "trackEvents": [
    {
      "trackIndex": 0,
      "soundAssetId": 101,
      "aiEventId": 42,
      "startTime": 0.0,
      "endTime": 15.5,
      "offset": 0.0,
      "volumeOverride": 80,
      "fadeIn": 0.5,
      "fadeOut": 1.0,
      "isUserEdited": true
    }
  ]
}
```

`type`은 `ambience | cinematic | dialogue_vo | foley | sfx | music` 중 하나.

**`aiEventId`**
- load 응답에서 받은 값을 그대로 round-trip. 유저가 수동 추가한 클립은 생략(또는 null).
- 백엔드는 값 유효성(해당 프로젝트 소속 ai_event인지)만 검증하고 그대로 저장. ai_events 테이블은 save 과정에서 **절대 변경·삭제되지 않는다**.

**Response 201**
```json
{
  "success": true,
  "data": { "id": 1, "version": 4, "createdAt": "2026-04-13T02:00:00Z" }
}
```

---

### GET /api/projects/:id/snapshots
스냅샷 히스토리 목록

**인증 필요**: 로그인 상태 (본인 프로젝트)

**Response 200**
```json
{
  "success": true,
  "data": {
    "snapshots": [
      { "id": 1, "version": 3, "createdAt": "2026-04-13T01:00:00Z" },
      { "id": 1, "version": 2, "createdAt": "2026-04-13T00:30:00Z" }
    ]
  }
}
```

---

### POST /api/projects/:id/snapshots/:version/restore
특정 버전으로 복원

**인증 필요**: 로그인 상태 (본인 프로젝트)

**Response 200**
```json
{ "success": true, "data": { "projectId": 1, "restoredVersion": 2 } }
```

복원된 스냅샷에도 각 이벤트의 `isUserEdited` 값은 유지되어야 한다.

---

### GET /api/projects/:id/analyses
프로젝트의 AI 분석 리포트 목록 — `project_analyses` 기반. 재분석 회차가 여러 번 돌면 내림차순(batch desc)으로 나온다.

**인증 필요**: 로그인 상태 (본인 프로젝트)

**Response 200**
```json
{
  "success": true,
  "data": {
    "analyses": [
      {
        "id": 12,
        "jobId": "550e8400-e29b-41d4-a716-446655440000",
        "analysisBatch": 2,
        "videoSummary": "충주맨 김선태가 ...",
        "videoContext": "충주시 홍보맨 ...",
        "eventCount": 58,
        "completedAt": "2026-04-15T04:01:33Z",
        "createdAt":   "2026-04-15T04:01:34Z"
      }
    ]
  }
}
```

`raw_payload` 와 `telemetry` 는 이 목록 API에서는 제외한다(목록은 가벼워야 함).

---

### GET /api/projects/:id/analyses/:batch
특정 회차의 AI 분석 리포트 상세. `raw_payload`, `telemetry` 포함.

**인증 필요**: 로그인 상태 (본인 프로젝트)

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": 12,
    "jobId": "550e8400-...",
    "analysisBatch": 2,
    "videoSummary": "...",
    "videoContext": "...",
    "rawPayload": { /* AI JobDoneMessage 원본 전체 */ },
    "telemetry":  { "llmUsage": {}, "metrics": {} },
    "completedAt": "2026-04-15T04:01:33Z"
  }
}
```

> `:batch` 는 `analysis_batch` 값. `latest` 를 넣으면 가장 최근 회차를 반환한다.

---

## 4. 효과음 (Sounds)

### GET /api/sounds
효과음 검색

**인증 필요**: 로그인 상태

**Query Parameters**
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| majorId | string | 대분류 UUID 필터 |
| midId | string | 중분류 UUID 필터 |
| subId | string | 소분류 UUID 필터 |
| mood | string | 분위기 필터 (`calm`, `dark` 등) |
| q | string | 키워드 검색 |
| page | number | 페이지 번호 |
| limit | number | 페이지당 개수 (기본값: 20) |

**Response 200**
```json
{
  "success": true,
  "data": {
    "sounds": [
      {
        "id": 1,
        "fileName": "rain_heavy_01.wav",
        "category": { "major": "ambience", "mid": "weather", "sub": "rain" },
        "mood": ["calm", "dark"],
        "tags": ["rain", "outdoor"],
        "duration": 30.5,
        "format": "wav",
        "designer": null
      }
    ],
    "total": 200,
    "page": 1,
    "limit": 20
  }
}
```

`designer`는 기본 라이브러리 에셋이면 `null`, 디자이너 업로드 에셋이면 객체다.  
`originalPath`는 public 조회 응답에 포함하지 않는다.

---

### GET /api/sounds/categories
카테고리 전체 트리 조회 (대/중/소 분류)

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "ambience",
      "children": [
        {
          "id": 1,
          "name": "weather",
          "children": [
            { "id": 1, "name": "rain" },
            { "id": 1, "name": "thunder" }
          ]
        }
      ]
    }
  ]
}
```

---

### GET /api/sounds/:id
효과음 단건 상세 조회

**인증 필요**: 로그인 상태

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "fileName": "rain_heavy_01.wav",
    "category": { "major": "ambience", "mid": "weather", "sub": "rain" },
    "mood": ["calm", "peaceful"],
    "tags": ["rain", "window", "interior"],
    "description": "창문 너머로 들리는 빗소리",
    "duration": 30.5,
    "format": "wav",
    "fileSize": 1234567,
    "downloadCount": 120,
    "designer": { "id": 1, "displayName": "Sound Studio A" }
  }
}
```

`originalPath`와 `embedding`은 internal metadata이므로 응답에 포함하지 않는다.

---

### GET /api/sounds/:id/similar
특정 에셋과 유사한 에셋 목록 (벡터 거리순). 에디터에서 클립 클릭 시 대체 후보 탐색용.

**인증 필요**: 로그인 상태

**검색 벡터 우선순위**
1. `trackEventId`가 주어지고 해당 track_event가 `ai_event_id`를 가지면 → **ai_events.embedding** (원 AI 의도)
2. 그 외 → `:id` 에셋의 **sound_assets.embedding** (파일 자체 유사)

즉, 가능하면 "원래 AI가 어떤 소리를 원했는가"로 검색하고, 유저가 수동 추가한 클립 등 맥락이 없을 때만 현재 사운드 파일 자체로 검색한다.

**Query Parameters**
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| trackEventId | number | 현재 클립의 `track_events.id`. 있으면 ai_event 기반 검색 시도 (선택) |
| level | string | `major` \| `mid` \| `sub` — 필터 기준 카테고리 레벨. 기본값: 소스 에셋의 `sub` |
| categoryId | number | 해당 level의 카테고리 ID. 기본값: 소스 에셋의 해당 level ID |
| limit | number | 페이지당 개수 (기본 50, 최대 100) |
| cursor | string | 이전 응답의 `nextCursor` (페이지네이션) |

클라이언트는 에셋 클릭 시 `trackEventId`를 함께 넘기고 `level=sub` 기본 호출, 사용자가 탭 전환할 때마다 level/categoryId를 바꿔 재호출한다. 탭 단위 응답은 프론트에서 캐싱.

**Response 200**
```json
{
  "success": true,
  "data": {
    "sourceId": 42,
    "queryVector": "ai_event",
    "aiEventId": 42,
    "level": "sub",
    "categoryId": 7,
    "sounds": [
      {
        "id": 101,
        "fileName": "rain_light_02.wav",
        "category": { "major": "ambience", "mid": "weather", "sub": "rain" },
        "mood": ["calm"],
        "duration": 28.3,
        "format": "wav",
        "designer": null,
        "similarity": 0.87
      }
    ],
    "nextCursor": "eyJkaXN0Ijo..."
  }
}
```

- `similarity`는 `1 - cosine_distance` (0~1, 1에 가까울수록 유사). 소스 자기 자신은 응답에서 제외한다.
- `queryVector`는 `"ai_event" | "sound_asset"` — 어떤 벡터로 검색했는지 명시. 프론트 배지/툴팁에 노출 가능.
- `aiEventId`는 ai_event 기반 검색 시에만 포함.

---

## 5. 마켓플레이스 (Marketplace)

### GET /api/marketplace
마켓플레이스 에셋 목록 (`designer_id IS NOT NULL`인 에셋만)

**Query Parameters**
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| majorId | string | 대분류 필터 |
| q | string | 키워드 검색 |
| page | number | 페이지 번호 |
| limit | number | 페이지당 개수 |

**Response 200** — `/api/sounds` 응답과 동일 구조, 단 `designer` 필드는 항상 객체

---

### GET /api/marketplace/designers/:designerId
특정 디자이너 프로필 + 업로드 에셋 목록

**Response 200**
```json
{
  "success": true,
  "data": {
    "designer": {
      "id": 1,
      "displayName": "Sound Studio A",
      "bio": "...",
      "soundCount": 42,
      "totalDownloads": 1500
    },
    "sounds": [
      {
        "id": 1,
        "fileName": "rain_heavy_01.wav",
        "format": "wav"
      }
    ]
  }
}
```

---

## 6. 내부 계약 (Redis Job Contract — HTTP 비공개)

외부 클라이언트는 Redis에 직접 접근하지 않는다.  
클라이언트는 `POST /api/projects/:id/analyze`로 작업을 시작하고, `GET /api/projects/:id/status`를 polling하여 진행 상황을 조회한다.

### 6.1 작업 요청 키
- Key: `job:request:{jobId}`
- Value:

```json
{
  "job_id": "job_abc123",
  "project_id": "prj_xyz789",
  "video_path": "/shared/uploads/prj_xyz789/input.mp4"
}
```

### 6.2 작업 진행률 키
- Key: `job:progress:{jobId}`
- Value:

```json
{
  "job_id": "job_abc123",
  "status": "matching",
  "progress": 75
}
```

`status` 가능한 값:
`pending | scene_splitting | analyzing | refining_timing | matching | placing | done | failed`

### 6.3 분석 완료 시 저장되는 스냅샷 구조
AI가 자동 생성한 이벤트는 `isUserEdited: false`로 저장한다.

```json
{
  "projectId": 1,
  "status": "ready",
  "snapshot": {
    "trackGroups": [
      {
        "type": "ambience",
        "tracks": [
          {
            "name": "Ambience 1",
            "events": [
              {
                "soundAssetId": 101,
                "startTime": 0.0,
                "endTime": 15.5,
                "offset": 0.0,
                "volumeOverride": 80,
                "fadeIn": 0.5,
                "fadeOut": 1.0,
                "isUserEdited": false
              }
            ]
          }
        ]
      }
    ]
  }
}
```

---

## 7. 보류 도메인

- 결제, 구독, 마켓플레이스 구매/정산 API는 ERD 확장 전까지 명세 대상에서 제외한다.
- 해당 도메인을 다시 추가하려면 최소한 `payments`, `subscriptions`, `asset_purchases`, `payouts` 수준의 저장 모델을 먼저 ERD에 반영해야 한다.
