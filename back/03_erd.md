# ERD (Entity Relationship Diagram)

## 1. 테이블 구조 (Mermaid)

```mermaid
erDiagram
    users {
        uuid id PK
        string email UK
        string name
        string profile_image_url
        string google_id UK
        enum role "user | designer | admin"
        enum plan "free | pro"
        int monthly_usage_count
        timestamp created_at
        timestamp updated_at
    }

    projects {
        uuid id PK
        uuid user_id FK
        string title
        string thumbnail_url
        enum status "uploading | analyzing | ready | rendering | done | failed"
        string original_video_url
        string final_video_url
        int duration_seconds
        timestamp created_at
        timestamp updated_at
    }

    track_groups {
        uuid id PK
        uuid project_id FK
        enum type "dialogue | music | background | foley | sfx | cinematic"
        int volume "0~100"
        boolean is_muted
        boolean is_solo
        int order
        timestamp created_at
        timestamp updated_at
    }

    tracks {
        uuid id PK
        uuid project_id FK "비정규화 — 조인 없이 프로젝트 단위 조회"
        uuid group_id FK
        string name
        int volume "0~100"
        int pan "-100~100"
        boolean is_muted
        int order
        timestamp created_at
        timestamp updated_at
    }

    track_events {
        uuid id PK
        uuid project_id FK "비정규화 — 조인 없이 프로젝트 단위 조회"
        uuid track_id FK
        uuid sound_asset_id FK
        float start_time
        float end_time
        float offset "원본 오디오 트림 시작점"
        int volume_override "0~100"
        float fade_in "페이드 인 (초)"
        float fade_out "페이드 아웃 (초)"
        boolean is_user_edited
        timestamp created_at
        timestamp updated_at
    }

    project_snapshots {
        uuid id PK
        uuid project_id FK
        int version
        jsonb snapshot "tracks + events 전체 상태"
        timestamp created_at
    }

    category_major {
        uuid id PK
        string name UK "ambience | foley | sfx | music | cinematic"
    }

    category_mid {
        uuid id PK
        uuid major_id FK
        string name "weather | footsteps | impact 등"
    }

    category_sub {
        uuid id PK
        uuid mid_id FK
        string name "rain | thunder | snow 등"
    }

    sound_assets {
        uuid id PK
        uuid designer_id FK "nullable (null이면 기본 라이브러리)"
        string file_name
        string s3_key
        string original_path "디자이너 원본 폴더 경로"
        uuid major_id FK
        uuid mid_id FK
        uuid sub_id FK "nullable"
        text[] mood "calm, peaceful 등"
        text[] tags "rain, window, interior 등"
        string description
        int bpm "음악만, 나머지 NULL"
        text[] instruments "음악만"
        float duration
        string format "mp3 | ogg | wav"
        int file_size "bytes"
        int download_count "사용 횟수"
        vector embedding "vector(3072) Gemini 임베딩"
        timestamp created_at
    }

    sound_designers {
        uuid id PK
        uuid user_id FK
        string display_name
        string bio
        float revenue_share_rate "default 0.7"
        timestamp created_at
    }

    projects ||--o{ project_snapshots : "has"
    users ||--o{ projects : "has"
    users ||--o| sound_designers : "can be"
    projects ||--o{ track_groups : "has"
    track_groups ||--o{ tracks : "contains"
    tracks ||--o{ track_events : "has"
    track_events }o--|| sound_assets : "uses"
    sound_designers ||--o{ sound_assets : "uploads"
    category_major ||--o{ category_mid : "has"
    category_mid ||--o{ category_sub : "has"
    category_major ||--o{ sound_assets : "classifies"
    category_mid ||--o{ sound_assets : "classifies"
    category_sub ||--o{ sound_assets : "classifies"
```

---

## 2. 테이블 설명

### users
사용자 계정 정보. Google OAuth로 가입/로그인 처리.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| email | VARCHAR | Google 계정 이메일 (unique) |
| name | VARCHAR | 표시 이름 |
| profile_image_url | VARCHAR | Google 프로필 이미지 URL |
| google_id | VARCHAR | Google 고유 ID (unique) |
| role | ENUM | user / designer / admin |
| plan | ENUM | free / pro |
| monthly_usage_count | INT | 당월 프로젝트 생성 수 (무료 플랜 제한용) |
| created_at | TIMESTAMP | 가입일 |
| updated_at | TIMESTAMP | 정보 수정일 |

### projects
사용자가 생성한 영상 프로젝트.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| title | VARCHAR | 프로젝트 이름 |
| thumbnail_url | VARCHAR | 프로젝트 썸네일 (영상 첫 프레임 등) |
| status | ENUM | 처리 상태 (uploading → analyzing → ready → ...) |
| original_video_url | VARCHAR | 원본 영상 파일 경로 |
| final_video_url | VARCHAR | 최종 렌더링된 영상 파일 경로 |
| duration_seconds | INT | 영상 길이 (초) |

### track_groups
트랙 대분류 그룹. 프로젝트 생성 시 6개 자동 생성됨.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| project_id | UUID | FK → projects |
| type | ENUM | dialogue / music / background / foley / sfx / cinematic |
| volume | INT | 그룹 전체 볼륨 (0 ~ 100) |
| is_muted | BOOLEAN | 그룹 뮤트 상태 |
| is_solo | BOOLEAN | 그룹 솔로 상태 |
| order | INT | 에디터 표시 순서 |
| created_at | TIMESTAMP | 생성일 |
| updated_at | TIMESTAMP | 수정일 |

### tracks
그룹 하위의 개별 트랙. 하나의 그룹 안에 여러 트랙이 존재할 수 있음.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| project_id | UUID | FK → projects (비정규화) |
| group_id | UUID | FK → track_groups |
| name | VARCHAR | 트랙 이름 |
| volume | INT | 트랙 볼륨 (0 ~ 100) |
| pan | INT | 좌우 패닝 (-100 ~ 100, 0이 중앙) |
| is_muted | BOOLEAN | 트랙 뮤트 상태 |
| order | INT | 그룹 내 표시 순서 |
| created_at | TIMESTAMP | 생성일 |
| updated_at | TIMESTAMP | 수정일 |

### track_events
각 트랙에 배치된 효과음 이벤트 (AI 결과 + 사용자 편집 내용).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| project_id | UUID | FK → projects (비정규화) |
| track_id | UUID | FK → tracks |
| sound_asset_id | UUID | FK → sound_assets |
| start_time | FLOAT | 효과음 시작 시간 (초) |
| end_time | FLOAT | 효과음 종료 시간 (초) |
| offset | FLOAT | 원본 오디오 트림 시작점 (초) |
| volume_override | INT | 이벤트 개별 볼륨 오버라이드 (0 ~ 100) |
| fade_in | FLOAT | 페이드 인 길이 (초) |
| fade_out | FLOAT | 페이드 아웃 길이 (초) |
| is_user_edited | BOOLEAN | 사용자가 수동 편집했는지 여부 |
| created_at | TIMESTAMP | 생성일 |
| updated_at | TIMESTAMP | 수정일 |

### project_snapshots
프로젝트 편집 히스토리. 버전별 전체 상태를 JSON으로 저장.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| project_id | UUID | FK → projects |
| version | INT | 스냅샷 버전 번호 |
| snapshot | JSONB | tracks + events 전체 상태 |
| created_at | TIMESTAMP | 생성일 |

### category_major / category_mid / category_sub
효과음 3단계 분류 체계 (대분류 → 중분류 → 소분류).

| 테이블 | 컬럼 | 타입 | 설명 |
|--------|------|------|------|
| category_major | id | UUID | PK |
| | name | VARCHAR | 대분류 |
| category_mid | id | UUID | PK |
| | major_id | UUID | FK → category_major |
| | name | VARCHAR | 중분류 |
| category_sub | id | UUID | PK |
| | mid_id | UUID | FK → category_mid |
| | name | VARCHAR | 소분류 |

### sound_assets
효과음 파일 메타데이터. 기본 라이브러리 + 마켓플레이스 에셋 모두 포함.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| designer_id | UUID | FK → sound_designers (null이면 기본 라이브러리) |
| file_name | VARCHAR | 파일 이름 |
| s3_key | VARCHAR | S3 저장 경로 |
| original_path | VARCHAR | 디자이너 업로드 시 원본 폴더 경로 (nullable, 트리 복원용) |
| major_id | UUID | FK → category_major (NOT NULL) |
| mid_id | UUID | FK → category_mid (NOT NULL) |
| sub_id | UUID | FK → category_sub (nullable) |
| mood | TEXT[] | 분위기 태그 (calm, peaceful 등) |
| tags | TEXT[] | 검색/매칭용 태그 (rain, window 등) |
| description | TEXT | 효과음 설명 |
| bpm | INT | BPM (음악만, 나머지 NULL) |
| instruments | TEXT[] | 악기 목록 (음악만) |
| duration | FLOAT | 효과음 길이 (초) |
| format | VARCHAR | 파일 포맷 (mp3, ogg, wav) |
| file_size | INT | 파일 크기 (bytes) |
| download_count | INT | 사용 횟수 |
| embedding | VECTOR(3072) | Gemini 임베딩 벡터 |
| created_at | TIMESTAMP | 생성일 |

### sound_designers
효과음 마켓플레이스 판매자.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| display_name | VARCHAR | 판매자 표시 이름 |
| bio | TEXT | 소개 |
| revenue_share_rate | FLOAT | 수익 배분율 (기본 0.7 = 70%) |

---

## 3. 주요 설계 결정

- **UUID 사용**: 순차 ID 대신 UUID를 사용하여 예측 불가능한 ID 보장
- **soft delete 미적용**: 초기 MVP에서는 하드 삭제 사용
- **sound_assets의 designer_id nullable**: 기본 라이브러리(null)와 마켓플레이스 에셋을 동일 테이블로 관리
- **track_events의 is_user_edited**: AI 결과와 사용자 편집 내역을 구분하여 추후 AI 개선 데이터로 활용 가능
- **tracks/track_events의 project_id 비정규화**: 에디터 로드 시 3단 조인(track_events → tracks → track_groups → projects) 회피. 읽기 빈도가 압도적인 실시간 에디터 특성에 맞춤
- **전 테이블 created_at/updated_at**: 디버깅, 정렬, 향후 멀티유저 협업 시 conflict resolution 대비
