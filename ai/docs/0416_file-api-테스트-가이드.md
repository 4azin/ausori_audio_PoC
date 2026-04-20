# File API 전환 — Langfuse + 파이프라인 테스트 가이드

> 작성일: 2026-04-16

---

## 0. 전체 흐름

```
1. Langfuse 서버 기동 (Docker)
2. Langfuse 초기 설정 (계정 + API Key)
3. ai/.env 설정
4. 프롬프트 시드 (seed_prompts.py)
5. 파이프라인 로컬 테스트 (analyze_global → foley → non_foley)
6. Langfuse UI 에서 trace 확인
```

---

## 1. Langfuse 서버 기동

### 1-1. .env 생성

```bash
cd ai/langfuse
cp .env.example .env
```

`.env` 시크릿 교체 (Git Bash 또는 WSL):

```bash
# ENCRYPTION_KEY — 반드시 64 hex chars
openssl rand -hex 32
# NEXTAUTH_SECRET
openssl rand -hex 32
# SALT
openssl rand -hex 16
```

나머지 패스워드도 적절히 교체:

```env
NEXTAUTH_SECRET=<위에서 생성한 값>
SALT=<위에서 생성한 값>
ENCRYPTION_KEY=<위에서 생성한 값>
POSTGRES_PASSWORD=langfuse-local
CLICKHOUSE_PASSWORD=langfuse-local
REDIS_AUTH=langfuse-local
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
```

### 1-2. Docker Compose 기동

```bash
cd ai/langfuse
docker compose up -d
```

모든 서비스가 healthy 될 때까지 대기 (1~2분):

```bash
docker compose ps
# 모든 서비스에 (healthy) 표시 확인

# 문제 있으면 로그 확인
docker compose logs -f langfuse-web
```

### 1-3. 포트 확인

| 서비스 | URL |
|--------|-----|
| Langfuse Web UI | http://localhost:3000 |
| Langfuse Worker | http://localhost:3030/api/health |
| MinIO Console | http://localhost:9091 |

---

## 2. Langfuse 초기 설정

1. 브라우저에서 `http://localhost:3000` 접속
2. 계정 생성 (최초 가입자 = admin)
3. Organization → Project 생성 (예: `soundai`)
4. Project Settings → **API Keys → Create new API keys**
5. `pk-lf-...` / `sk-lf-...` 복사

---

## 3. ai/.env 설정

```bash
cd ai
cp .env.example .env
```

`.env`에 아래 값 채우기:

```env
# Gemini — 테스트에 필요한 항목만
GEMINI_API_VIDEO=<Gemini API 키>
GEMINI_MODEL=gemini-2.5-flash

# Langfuse — §2에서 발급한 키
LANGFUSE_PUBLIC_KEY=pk-lf-xxxxxxxx
LANGFUSE_SECRET_KEY=sk-lf-xxxxxxxx
LANGFUSE_HOST=http://localhost:3000
```

> Redis/S3 설정은 로컬 단독 테스트 시 불필요 (pipeline.py가 redis 없으면 graceful fallback)

---

## 4. 프롬프트 시드

Langfuse Prompts에 최신 프롬프트를 업로드:

```bash
cd ai
python seed_prompts.py
```

정상이면:

```
[info] Langfuse: http://localhost:3000  label=production  dry_run=False
  [creating] global_analyzer  (기존 최신: 없음)
    -> 생성됨 v1
  [creating] foley_analyzer  (기존 최신: 없음)
    -> 생성됨 v1
  [creating] non_foley_analyzer  (기존 최신: 없음)
    -> 생성됨 v1
[done]
```

> `--dry-run` 으로 먼저 확인 가능: `python seed_prompts.py --dry-run`

---

## 5. 파이프라인 테스트

### 5-1. 테스트용 영상 준비

짧은 영상(10~30초)으로 테스트. 비용과 시간 절약.

### 5-2. 단계별 개별 테스트

File API 전환이 잘 되었는지 단계별로 확인:

```bash
cd ai

# (1) Global 분석 — 영상 통째로 업로드 확인
python analyze_global.py <영상경로> --out output/test_global.json
```

확인 포인트:
- `[upload] 영상 업로드 중...` 로그 출력
- `[upload] 처리 완료: files/... (state=ACTIVE)` 출력
- `[upload] 삭제 완료: files/...` 출력
- `output/test_global.json`에 scenes 결과 정상

```bash
# (2) Foley 분석 — scene별 trim + 업로드 확인
python analyze_local_foley.py <영상경로> --result output/test_global.json --out output/test_foley.json
```

확인 포인트:
- scene마다 `[upload]` 로그 반복
- scene별 이벤트 추출 정상

```bash
# (3) Non-foley 분석
python analyze_local_non_foley.py <영상경로> --result output/test_global.json --out output/test_non_foley.json
```

### 5-3. 전체 파이프라인 테스트

Redis 없이 로컬 dict로 실행:

```bash
cd ai
python -c "
import pipeline, json

job = {
    'jobId': 'test-file-api-001',
    'projectId': 1,
    'videoPath': '<영상경로>'
}

result = pipeline.run(job)
print(json.dumps(result if isinstance(result, dict) else result.model_dump(by_alias=True), ensure_ascii=False, indent=2))
" > output/test_pipeline_result.json
```

---

## 6. Langfuse UI 에서 trace 확인

### 6-1. 접속

브라우저에서 `http://localhost:3000` → 프로젝트 선택 → **Traces** 탭

### 6-2. 확인할 trace 구조

`test-file-api-001` session을 찾으면 아래 구조가 보여야 함:

```
trace: ai-pipeline
  ├── span: global_analyzing
  │     ├── span: video_upload        ← [신규] file_size_bytes, upload latency
  │     ├── generation: gemini:global ← input/output tokens, cost, latency
  │     └── span: video_cleanup       ← [신규] gemini_file_name
  │
  ├── span: foley_analyzing
  │     └── scene 마다:
  │           ├── span: ffmpeg_trim        ← [신규] scene_id, start, end, duration
  │           ├── span: video_upload       ← [신규]
  │           ├── generation: gemini:foley:sceneN
  │           └── span: video_cleanup      ← [신규]
  │
  └── span: non_foley_analyzing
        └── scene 마다:
              ├── span: ffmpeg_trim        ← [신규]
              ├── span: video_upload       ← [신규]
              ├── generation: gemini:non_foley:sceneN
              └── span: video_cleanup      ← [신규]
```

### 6-3. 체크리스트

| 항목 | 확인 위치 | 기대값 |
|------|-----------|--------|
| trace 생성 여부 | Traces 목록 | `ai-pipeline` 이름으로 1건 |
| video_upload span | trace 상세 → span 트리 | `file_size_bytes` metadata 존재 |
| video_cleanup span | trace 상세 → span 트리 | `gemini_file_name` metadata 존재 |
| ffmpeg_trim span | trace 상세 → span 트리 | `scene_id`, `duration` metadata 존재 |
| generation 토큰 | generation 상세 | `input` 토큰이 기존 프레임 방식보다 감소했는지 |
| generation 비용 | generation 상세 | `cost_details.total` 존재 |
| trace output | trace 상세 → output | `timing`, `metrics`, `llm_usage` 포함 |
| trace metadata | trace 상세 → metadata | `timing.upload_total_sec` 존재 |

### 6-4. telemetry 비교 (File API vs 기존)

파이프라인 결과 JSON의 `telemetry` 필드 확인:

```bash
python -c "
import json
with open('output/test_pipeline_result.json', encoding='utf-8') as f:
    d = json.load(f)
t = d.get('telemetry', {})
print(json.dumps(t, indent=2, ensure_ascii=False))
"
```

기대 출력 예시:

```json
{
  "sceneCount": 5,
  "llmUsage": {
    "calls": 11,
    "prompt": 45000,
    "output": 8000,
    "cached": 0,
    "total": 53000,
    "latency_sec": 85.2,
    "cost_usd": 0.052
  },
  "metrics": { ... },
  "timing": {
    "global_sec": 15.3,
    "foley_sec": 40.1,
    "non_foley_sec": 35.7,
    "upload_total_sec": 12.4,
    "total_sec": 91.1
  },
  "inputMethod": "file_api"
}
```

확인:
- `inputMethod`가 `"file_api"` 인지
- `timing` 각 항목이 합리적인지
- `llmUsage.cost_usd`가 기존 ~$1.20 대비 줄었는지

---

## 7. 트러블슈팅

### Langfuse 연결 안 됨

```
[llm] Langfuse 초기화 실패 (계속 진행): ...
```

- `docker compose ps`로 langfuse-web이 healthy인지 확인
- `.env`의 `LANGFUSE_HOST`가 `http://localhost:3000`인지 확인
- API Key가 올바른 프로젝트의 것인지 확인

### File API 업로드 실패

```
RuntimeError: Gemini 파일 처리 실패: files/...
```

- `GEMINI_API_VIDEO` 키가 유효한지 확인
- 영상 파일이 Gemini 지원 형식(mp4, mov 등)인지 확인
- 파일 크기 2GB 이하인지 확인

### ffmpeg trim 실패

```
subprocess.CalledProcessError: ...
```

- `ffmpeg`가 PATH에 있는지: `ffmpeg -version`
- 입력 영상이 손상되지 않았는지 확인

### trace에 span이 안 보임

- Langfuse SDK가 flush 되기 전에 프로세스가 종료됐을 수 있음
- pipeline 정상 완료 시 자동 flush → 문제 없어야 함
- 수동 확인: Langfuse UI에서 1~2분 대기 후 새로고침

---

## 8. 정리 (테스트 후)

```bash
# Langfuse 서버 중지 (데이터 보존)
cd ai/langfuse
docker compose stop

# 완전 초기화 (데이터 삭제)
docker compose down -v

# Gemini File API 잔여 파일 확인 (48시간 후 자동 삭제)
# 수동 확인/삭제가 필요하면:
python -c "
from google import genai
import config
client = genai.Client(api_key=config.GEMINI_API_VIDEO)
for f in client.files.list():
    print(f.name, f.state, f.size_bytes)
"
```
