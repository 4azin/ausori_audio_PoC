# API 명세서

## 공통 규칙

### Base URL
```
개발: http://localhost:3000/api
운영: https://api.[서비스명].com
```

### 인증
JWT 기반 인증. 보호된 엔드포인트는 요청 헤더에 Access Token 필요.
```
Authorization: Bearer <access_token>
```

### 응답 형식
```json
// 성공
{
  "success": true,
  "data": { ... }
}

// 실패
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "에러 메시지"
  }
}
```

### HTTP 상태 코드
| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 201 | 생성 성공 |
| 400 | 잘못된 요청 |
| 401 | 인증 필요 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 429 | 요청 한도 초과 |
| 500 | 서버 오류 |

---

## 1. 인증 (Auth)

### POST /auth/google
Google OAuth 로그인/회원가입

**Request Body**
```json
{
  "code": "google_authorization_code"
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "user": {
      "id": "uuid",
      "email": "user@gmail.com",
      "name": "홍길동",
      "profileImageUrl": "https://...",
      "plan": "free"
    }
  }
}
```

---

### POST /auth/refresh
Access Token 갱신

**Request Body**
```json
{
  "refreshToken": "eyJhbGci..."
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci..."
  }
}
```

---

### POST /auth/logout
로그아웃 (Refresh Token 무효화)

**Headers**: `Authorization: Bearer <access_token>`

**Response 200**
```json
{
  "success": true,
  "data": null
}
```

---

## 2. 사용자 (Users)

### GET /users/me
내 프로필 조회

**Headers**: `Authorization: Bearer <access_token>`

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@gmail.com",
    "name": "홍길동",
    "profileImageUrl": "https://...",
    "plan": "free",
    "monthlyUsageCount": 1
  }
}
```

---

## 3. 프로젝트 (Projects)

### GET /projects
내 프로젝트 목록 조회

**Headers**: `Authorization: Bearer <access_token>`

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
        "id": "uuid",
        "title": "내 첫 번째 영상",
        "status": "ready",
        "durationSeconds": 120,
        "createdAt": "2026-04-13T00:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10
  }
}
```

---

### POST /projects
새 프로젝트 생성 (영상 업로드)

**Headers**: `Authorization: Bearer <access_token>`  
**Content-Type**: `multipart/form-data`

**Request Body**
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| video | File | ✓ | 영상 파일 (mp4, mov) |
| title | string | | 프로젝트 제목 (기본값: 파일명) |

**Response 201**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "내 첫 번째 영상",
    "status": "uploading",
    "createdAt": "2026-04-13T00:00:00Z"
  }
}
```

---

### GET /projects/:id
프로젝트 상세 조회 (트랙 및 이벤트 포함)

**Headers**: `Authorization: Bearer <access_token>`

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "내 첫 번째 영상",
    "status": "ready",
    "originalVideoUrl": "https://...",
    "finalVideoUrl": null,
    "durationSeconds": 120,
    "tracks": [
      {
        "id": "uuid",
        "type": "background",
        "volume": 0.8,
        "order": 1,
        "events": [
          {
            "id": "uuid",
            "startTime": 0.0,
            "endTime": 15.5,
            "volumeOverride": 1.0,
            "isUserEdited": false,
            "soundAsset": {
              "id": "uuid",
              "name": "카페 배경 소음",
              "fileUrl": "https://...",
              "durationSeconds": 30.0
            }
          }
        ]
      }
    ]
  }
}
```

---

### PATCH /projects/:id
프로젝트 정보 수정 (제목 변경 등)

**Headers**: `Authorization: Bearer <access_token>`

**Request Body**
```json
{
  "title": "새 제목"
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "새 제목"
  }
}
```

---

### DELETE /projects/:id
프로젝트 삭제

**Headers**: `Authorization: Bearer <access_token>`

**Response 200**
```json
{
  "success": true,
  "data": null
}
```

---

### POST /projects/:id/analyze
AI 분석 요청 (영상 업로드 완료 후 호출)

**Headers**: `Authorization: Bearer <access_token>`

**Response 200**
```json
{
  "success": true,
  "data": {
    "projectId": "uuid",
    "status": "analyzing"
  }
}
```

---

### POST /projects/:id/render
최종 영상 렌더링 요청

**Headers**: `Authorization: Bearer <access_token>`

**Response 200**
```json
{
  "success": true,
  "data": {
    "projectId": "uuid",
    "status": "rendering"
  }
}
```

---

## 4. 트랙 이벤트 편집 (Editor)

### PUT /projects/:id/tracks/:trackId/events
트랙 이벤트 일괄 업데이트 (에디터 저장)

**Headers**: `Authorization: Bearer <access_token>`

**Request Body**
```json
{
  "events": [
    {
      "id": "uuid",
      "soundAssetId": "uuid",
      "startTime": 0.0,
      "endTime": 15.5,
      "volumeOverride": 0.9
    }
  ]
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "trackId": "uuid",
    "events": [ ... ]
  }
}
```

---

### PATCH /projects/:id/tracks/:trackId
트랙 볼륨 조정

**Headers**: `Authorization: Bearer <access_token>`

**Request Body**
```json
{
  "volume": 0.6
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "trackId": "uuid",
    "volume": 0.6
  }
}
```

---

## 5. 효과음 (Sound Assets)

### GET /sounds
효과음 검색

**Query Parameters**
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| category | string | 카테고리 필터 (background, foley, sfx 등) |
| q | string | 키워드 검색 |
| page | number | 페이지 번호 |
| limit | number | 페이지당 개수 |

**Response 200**
```json
{
  "success": true,
  "data": {
    "sounds": [
      {
        "id": "uuid",
        "name": "카페 배경 소음",
        "category": "background",
        "tags": ["cafe", "indoor", "ambient"],
        "fileUrl": "https://...",
        "durationSeconds": 30.0
      }
    ],
    "total": 100
  }
}
```

---

## 6. AI 내부 통신 (Backend ↔ AI Server)

> 외부에 노출되지 않는 내부 API

### POST /internal/analyze
AI 서버에 영상 분석 요청

**Request Body**
```json
{
  "projectId": "uuid",
  "videoUrl": "https://..."
}
```

**Response (AI 서버 → 백엔드 콜백)**
```json
{
  "projectId": "uuid",
  "tracks": [
    {
      "type": "background",
      "events": [
        {
          "startTime": 0.0,
          "endTime": 15.5,
          "suggestedTags": ["cafe", "indoor"],
          "category": "background"
        }
      ]
    }
  ]
}
```
