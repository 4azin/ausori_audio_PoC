# 개발 환경 설정 가이드

## 사전 요구사항

| 도구 | 버전 | 확인 명령어 |
|------|------|------------|
| Node.js | 20.x 이상 | `node -v` |
| npm | 10.x 이상 | `npm -v` |
| Python | 3.11 이상 | `python --version` |
| PostgreSQL | 15 이상 | `psql --version` |
| Git | 최신 | `git --version` |

---

## 1. 레포지토리 클론

```bash
git clone https://lab.ssafy.com/s14-final/S14P31F104.git
cd S14P31F104
```

---

## 2. 백엔드 설정

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

# 데이터베이스
DATABASE_URL=postgresql://postgres:password@localhost:5432/sounddesign_dev

# JWT
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# AI 서버
AI_SERVER_URL=http://localhost:8000

# 파일 스토리지 (미정, 로컬 임시 경로)
UPLOAD_DIR=./uploads
```

### 데이터베이스 생성
```bash
psql -U postgres
CREATE DATABASE sounddesign_dev;
\q
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

## 3. 프론트엔드 설정

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

## 4. AI 서버 설정

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
PORT=8000
BACKEND_CALLBACK_URL=http://localhost:3000/api/internal/analyze/callback
```

### 실행
```bash
# FastAPI 예정
uvicorn main:app --reload --port 8000
```

---

## 5. 전체 실행 순서

```
1. PostgreSQL 서버 실행
2. cd back && npm run dev     (포트 3000)
3. cd ai && uvicorn ...       (포트 8000)
4. cd front && npm run dev    (포트 5173)
```

---

## 6. 브랜치 전략

```
master        ── 배포 브랜치 (직접 push 금지)
  └── develop ── 통합 브랜치
        ├── feature/back/기능명   ── 백엔드 기능 개발
        ├── feature/front/기능명  ── 프론트엔드 기능 개발
        └── feature/ai/기능명     ── AI 기능 개발
```

### 브랜치 네이밍 예시
- `feature/back/auth-google-oauth`
- `feature/front/editor-timeline`
- `feature/ai/video-scene-analysis`
- `fix/back/jwt-refresh-token`

---

## 7. 커밋 컨벤션

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
