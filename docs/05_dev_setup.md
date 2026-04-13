# 개발 환경 설정 가이드

## 사전 요구사항

| 도구 | 버전 | 확인 명령어 |
|------|------|------------|
| Node.js | 22.x (LTS) | `node -v` |
| npm | 10.x 이상 | `npm -v` |
| Python | 3.11 이상 | `python --version` |
| Docker | 최신 | `docker --version` |
| Docker Compose | 최신 | `docker compose version` |
| Git | 최신 | `git --version` |

---

## 1. 레포지토리 클론

```bash
git clone https://lab.ssafy.com/s14-final/S14P31F104.git
cd S14P31F104
```

---

## 2. Docker로 인프라 실행

```bash
cd back
docker compose up -d
```

Redis, PostgreSQL 등 인프라 서비스가 실행됩니다.

---

## 3. 백엔드 설정

```bash
cd back
npm install
```

### 환경변수 설정
`back/.env` 파일을 생성하고 아래 내용을 채워넣습니다.

```env
# 서버
PORT=3000
NODE_ENV=development

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# 세션
SESSION_SECRET=your_session_secret_here

# 데이터베이스
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sounddesign_dev
DB_USER=postgres
DB_PASSWORD=postgres

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# AWS S3
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET=your_bucket_name
```

### 서버 실행
```bash
# 개발 모드 (파일 변경 시 자동 재시작)
npm run dev

# 빌드 후 실행
npm run build
npm start
```

---

## 4. 프론트엔드 설정

```bash
cd front
npm install
```

### 환경변수 설정
`front/.env` 파일 생성:

```env
VITE_API_URL=http://localhost:3000/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

### 실행
```bash
npm run dev
```

---

## 5. AI 서버 설정

```bash
cd ai
python -m venv venv

# macOS / Linux
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r requirements.txt
```

### 환경변수 설정
`ai/.env` 파일 생성:

```env
# Redis (작업 큐)
REDIS_HOST=localhost
REDIS_PORT=6379

# AWS S3 (영상 다운로드)
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET=your_bucket_name
```

### 실행
```bash
# Redis 워커로 실행
python worker.py
```

---

## 6. 전체 실행 순서

```
1. docker compose up -d         (Redis + PostgreSQL)
2. cd back && npm run dev       (포트 3000)
3. cd ai && python worker.py    (Redis 워커)
4. cd front && npm run dev      (포트 5173)
```

---

## 7. 브랜치 전략

```
master        ── 배포 브랜치 (직접 push 금지)
  ├── front   ── 프론트엔드 통합 브랜치
  ├── back    ── 백엔드 통합 브랜치
  └── ai      ── AI 통합 브랜치
```

### 브랜치 네이밍 예시
- `feature/back/auth-google-oauth`
- `feature/front/editor-timeline`
- `feature/ai/video-scene-analysis`
- `fix/back/session-expire`

---

## 8. 커밋 컨벤션

프로젝트 루트 `README.md` 참고.

```
<type>(<scope>): <subject>
```

예시:
```
feat(back/auth): add google oauth login
fix(front/editor): resolve timeline drag bug
docs(erd): update sound_assets table
```
