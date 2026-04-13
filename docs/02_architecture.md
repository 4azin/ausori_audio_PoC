# 시스템 아키텍처

## 1. 전체 구조

```
┌─────────────────────────────────────────────────────────┐
│                       Client                            │
│              React (Web / Mobile)                       │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP/REST
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   Backend Server                        │
│         Node.js + TypeScript + Express                  │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Auth API   │  │  Video API   │  │  Project API  │  │
│  │(OAuth+세션) │  │ (업로드/관리) │  │  (에디터 저장) │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              PostgreSQL                         │   │
│  │  users / projects / tracks / sound_assets 등    │   │
│  └─────────────────────────────────────────────────┘   │
└──────────┬──────────────────────────┬───────────────────┘
           │ S3 SDK                   │ Redis Pub/Sub
           ▼                          ▼
┌─────────────────────┐  ┌────────────────────────────────┐
│    File Storage     │  │            Redis               │
│      (AWS S3)       │  │                                │
│ - 원본 영상         │  │  ┌──────────┐  ┌───────────┐  │
│ - 효과음 라이브러리 │  │  │ 작업 요청 │→│ 진행 상황  │  │
│ - 최종 렌더링 영상  │  │  │ (enqueue)│  │(progress) │  │
└─────────────────────┘  │  └──────────┘  └───────────┘  │
                         └──────────┬─────────────────────┘
                                    │ Redis Polling
                                    ▼
                         ┌────────────────────────────────┐
                         │          AI Server             │
                         │      Python (Worker)           │
                         │                                │
                         │  1. Redis에서 작업 요청 수신    │
                         │  2. S3에서 영상 다운로드        │
                         │  3. 장면 분석 + 효과음 매칭     │
                         │  4. 진행 상황 Redis에 업데이트  │
                         │  5. 결과를 Redis/DB에 저장      │
                         └────────────────────────────────┘
```

---

## 2. 기술 스택

### Frontend
| 항목 | 기술 |
|------|------|
| 프레임워크 | React |
| 언어 | TypeScript (예정) |

### Backend
| 항목 | 기술 |
|------|------|
| 런타임 | Node.js (v22 LTS) |
| 언어 | TypeScript |
| 프레임워크 | Express 5 |
| DB | PostgreSQL |
| 세션 스토어 | Redis (connect-redis) |
| 인증 | Google OAuth 2.0 + 세션 |
| 파일 스토리지 | AWS S3 |
| 입력 검증 | Zod |

### AI Server
| 항목 | 기술 |
|------|------|
| 언어 | Python |
| 동작 방식 | Redis 기반 Worker (REST API 없음) |

### 인프라
| 항목 | 기술 |
|------|------|
| 컨테이너 | Docker / Docker Compose |
| 메시지 브로커 | Redis 7 |
| 파일 스토리지 | AWS S3 |
| 배포 | 미정 |

---

## 3. 서비스 간 통신

### 클라이언트 ↔ 백엔드
- REST API (JSON)
- 세션 기반 인증 (쿠키)

### 백엔드 → AI 서버 (작업 요청)
- 백엔드가 Redis에 작업 요청을 enqueue
  ```json
  {
    "job_id": "job_abc123",
    "project_id": "prj_xyz789",
    "video_path": "/shared/uploads/prj_xyz789/input.mp4"
  }
  ```
- AI 서버가 Redis를 polling하여 작업을 수신

### AI 서버 → 백엔드 (진행 상황)
- AI 서버가 Redis에 진행 상황을 업데이트
  ```json
  { "job_id": "job_abc123", "status": "scene_splitting", "progress": 15 }
  { "job_id": "job_abc123", "status": "analyzing", "progress": 35 }
  { "job_id": "job_abc123", "status": "refining_timing", "progress": 55 }
  { "job_id": "job_abc123", "status": "matching", "progress": 75 }
  { "job_id": "job_abc123", "status": "placing", "progress": 90 }
  { "job_id": "job_abc123", "status": "done", "progress": 100 }
  ```
- 백엔드가 Redis를 polling하여 클라이언트에 진행 상황 전달

### 백엔드 / AI 서버 ↔ 파일 스토리지
- AWS SDK를 통한 파일 업로드/다운로드 (Presigned URL 방식)

---

## 4. 인증 플로우

```
1. 클라이언트에서 "Google로 로그인" 클릭
2. Google OAuth 2.0 인증 페이지로 리다이렉트
3. 사용자 동의 후 Google에서 authorization code 반환
4. 백엔드에서 authorization code로 Google access token 교환
5. Google API로 사용자 정보(이메일, 이름, 프로필) 가져오기
6. DB에 사용자 upsert (없으면 신규 가입, 있으면 로그인)
7. 세션 생성 (Redis에 저장) + 쿠키 발급
8. 클라이언트는 이후 요청에 세션 쿠키 자동 포함
```

---

## 5. 영상 처리 플로우

```
1. 클라이언트에서 영상 파일 업로드
2. 백엔드가 S3에 저장 → 저장 경로(key) 획득
3. 백엔드가 Redis에 AI 작업 요청 enqueue (job_id + video_path)
4. AI 서버가 Redis에서 작업 수신
5. AI 서버가 S3에서 영상 다운로드 → 분석 시작
6. AI 서버가 Redis에 진행 상황 업데이트 (15% → 35% → ... → 100%)
7. 분석 완료 시 6트랙 배치 결과를 Redis/DB에 저장
   {
     "tracks": [
       { "type": "background", "events": [{ "start": 0.0, "end": 5.5, "soundId": "..." }] },
       { "type": "foley", "events": [...] },
       ...
     ]
   }
8. 백엔드가 완료 감지 → 클라이언트에 결과 전달
9. 클라이언트가 웹 에디터에서 결과 확인 및 수정
10. 최종 렌더링 요청 → 완성된 영상 다운로드
```
