# 파이프라인 실행법 & Observation 구현사항 (2026-04-15 기준)

AI 영상 분석 파이프라인(`ai/pipeline.py`) 의 현재 실행 방법과, LLM observability(Langfuse) 로 얻을 수 있는 관측 지표를 한 번에 정리한다.

---

## 1. 사전 준비

### 1.1 Python 환경

```bash
cd ai
pip install -r requirements.txt     # langfuse 포함
```

### 1.2 `.env` (프로젝트 루트 `ai/.env`)

`.env.example` 참고:

```
# Redis / S3 / Worker (기존)
REDIS_HOST=localhost
REDIS_PORT=6379
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-northeast-2
AWS_S3_BUCKET=...
POLL_INTERVAL=1.0

# Gemini
GEMINI_API_VIDEO=<Gemini API 키>

# Langfuse
LANGFUSE_PUBLIC_KEY=pk-lf-xxxxxxxx
LANGFUSE_SECRET_KEY=sk-lf-xxxxxxxx
LANGFUSE_HOST=http://localhost:3000

# (옵션) LLM 호출 JSONL 로그
# LLM_USAGE_LOG=logs/llm_usage.jsonl
```

> **키 이름 주의**: `GOOGLE_API_KEY` 는 폐기되고 **`GEMINI_API_VIDEO`** 로 통일됨.

### 1.3 Langfuse Self-host 기동

```bash
cd ai/langfuse
cp .env.example .env        # 비밀값은 랜덤값으로 교체 (openssl rand -hex 32)
docker compose up -d
docker compose ps           # 전부 healthy 될 때까지 1~2분
```

브라우저에서 `http://localhost:3000`:
1. 계정 생성(최초 가입자 = admin).
2. Organization → Project 생성 (예: `s14p31f104-ai`).
3. Project Settings → API Keys → Create → 위 `.env` 의 `LANGFUSE_*` 3종에 반영.

### 1.4 프롬프트 업로드 (최초 1회)

```bash
cd ai
python seed_prompts.py --dry-run    # 확인
python seed_prompts.py              # 실제 업로드
```

- 4개 프롬프트(`global_analyzer`, `global_music_analyzer`, `foley_analyzer`, `non_foley_analyzer`) 가 `production` 라벨이 붙은 v1 으로 생성됨.
- 동일 내용 재실행은 skip 됨. 프롬프트를 바꾸면 새 버전이 생성되고 `production` 라벨이 옮겨간다.
- UI 의 Prompts → 이름 클릭 → Versions 목록에서 `production`, `latest` **라벨 배지** 확인 가능. (상단 테이블의 Tags 컬럼은 tag 이지 label 이 아님.)

---

## 2. 파이프라인 실행

### 2.1 Redis 없이 로컬에서 돌리기 (가장 빠름)

```bash
cd ai
python -c "
import pipeline, json

job = {
    'job_id': 'lf_test_001',
    'video_path': '당근광고영상.mp4'
}

result = pipeline.run(job)

with open('pipeline_result.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
print('완료')
"
```

### 2.2 Worker 경로 (Redis/S3)

`ai/worker.py` 가 Redis 큐에서 job 을 꺼내 `pipeline.run(job)` 을 호출. `ai/.env` 에 Redis/S3 값이 채워져 있어야 함.

### 2.3 출력

- stdout 에 진행상황(`[progress] ...`), LLM 호출 한 줄씩(`[llm] {...}`), 마지막에 요약(`=== LLM Usage Summary ===`).
- 반환/저장되는 JSON 에 기존 `video_summary`, `foley`, `ambience`, `music`, ... 트랙별 배열 + **추가 필드 2개**:
  - `llm_usage`: stage 별/전체 토큰·지연·비용 집계.
  - `metrics`: 결과 기반 관측 지표 (아래 §3.2).

---

## 3. 현재 구현된 Observation

### 3.1 계층 구조 (Trace → Span → Generation)

한 번의 `pipeline.run(job)` 이 Langfuse 에서 하나의 **trace** 로 떨어진다.

```
[trace] ai-pipeline            ← pipeline.run() 전체. metadata: job_id, video_name, ...
  ├─ [span] global_analyzing
  │    └─ [generation] gemini:global              ← analyze_global.analyze()
  ├─ [span] foley_analyzing
  │    ├─ [generation] gemini:foley:scene1
  │    ├─ [generation] gemini:foley:scene2
  │    └─ ... (scene 수만큼)
  └─ [span] non_foley_analyzing
       ├─ [generation] gemini:non_foley:scene1
       └─ ...
```

구현 위치:
- `ai/pipeline.py` — `llm_client.start_trace(...)` 로 루트 trace, `llm_client.start_span(...)` 으로 각 stage.
- `ai/llm_client.py` — `generate_content(..., stage=..., scene_id=..., prompt=...)` 래퍼가 호출마다 `start_as_current_generation` 을 감싼다.

Langfuse 미설정(키 없음/서버 다운) 인 환경에서는 **자동으로 no-op** 이 되어 기존대로 실행된다.

### 3.2 Generation 단위로 기록되는 것

각 Gemini 호출마다:

| 필드 | 내용 | 출처 |
|---|---|---|
| `model` | `gemini-3-flash-preview` 등 | `GEMINI_MODEL` |
| `input.prompt` | 전송된 프롬프트 텍스트(컨텍스트 포함) | `_summarize_contents` |
| `input.image_count` | 전송된 프레임 장수 | 〃 |
| `output` | Gemini raw JSON 텍스트 | `response.text` |
| `usage_details.input/output/cached/total` | 토큰 수 | `response.usage_metadata` |
| `cost_details.total` | USD (PRICING 테이블 기반 자동 산출) | `llm_client.PRICING` |
| `metadata.stage` | `global` / `foley` / `non_foley` / `global_music` | 래퍼 인자 |
| `metadata.scene_id` | scene 번호 (해당 stage 에만) | 〃 |
| `metadata.prompt_name / version / source` | `foley_analyzer v3` 같은 링크용 | Langfuse prompt 링크 |
| `latency_sec` | 래퍼가 `time.perf_counter` 로 측정 | 〃 |

프롬프트 바이너리(프레임 이미지) 는 **제외** 하고 개수만 기록. 프롬프트-generation 링크는 Langfuse SDK 의 `prompt=` 인자로 자동 연결되어, UI 의 generation 카드에서 프롬프트 버전으로 바로 점프 가능.

### 3.3 Trace 단위로 기록되는 관측 지표 (`metrics`)

`pipeline._compute_metrics()` 가 결과에서 산출해 **trace 의 output/metadata 와 반환 JSON 의 `result.metrics`** 에 동시 기록:

| 키 | 의미 |
|---|---|
| `scene_count` | 글로벌 분석이 나눈 scene 개수 |
| `foley_event_count` | 추출된 Foley 이벤트 총 개수 |
| `foley_confidence` | `{count, mean, p50, min, max}` |
| `non_foley_total_count` | non-foley 트랙 엔트리 총 개수 |
| `non_foley_confidence` | 〃 |
| `non_foley_by_track` | `{ambience, music, cinematic, sfx, dialogue_vo}` 별 개수 |
| `non_foley_mood_fill_ratio` | non-foley 엔트리 중 mood 필드가 채워진 비율 |
| `non_foley_energy_fill_ratio` | 〃 energy |
| `non_foley_texture_fill_ratio` | 〃 texture |

이 지표들이 목적이다. "정답 대비 정확도" 가 아니라 **프롬프트/fps/모델을 바꿔가며 돌렸을 때 결과의 양·상세도·확신도가 어떻게 움직이는가** 를 Langfuse UI 에서 trace 간 비교로 볼 수 있다.

### 3.4 토큰·비용 집계 (`llm_usage`)

`llm_client.UsageTracker` 가 job 단위로 모든 호출을 누적해서:

- stdout 에 `=== LLM Usage Summary ===` 로 출력.
- 반환 JSON `result.llm_usage` 에 `{overall, by_stage}` 로 저장.
- Trace metadata 에도 `llm_usage_by_stage` 로 복사.

산식:
```
cost = (prompt - cached) * PRICING[model].input
     + cached             * PRICING[model].cached
     + output             * PRICING[model].output
(단위: USD / 1M tokens)
```

모델 → 가격 매핑은 `ai/llm_client.py` 상단 `PRICING` 딕셔너리에 정의. 새 모델 추가 시 여기만 업데이트하면 됨.

### 3.5 로컬 JSONL 로그 (옵션)

`LLM_USAGE_LOG=logs/llm_usage.jsonl` 세팅 시, 호출마다 한 줄씩 JSONL 파일에 append. Langfuse 없이도 가시성 확보 가능(백업/오프라인 분석용).

---

## 4. Langfuse UI 에서 확인하는 법

1. `http://localhost:3000` → 프로젝트 → **Traces**.
2. `name=ai-pipeline` 필터. 방금 돌린 job 의 `session_id` = `job_id`.
3. Trace 클릭 → 왼쪽 트리에서 span/generation 계층 확인.
4. Generation 행에서:
   - **Usage** 탭: prompt/output/cached/total tokens.
   - **Cost** 탭: USD.
   - **Prompt** 링크: 해당 호출이 쓴 프롬프트 버전으로 점프.
5. Trace 의 Metadata 탭에서 `metrics` 확인 (`foley_event_count`, confidence 분포 등).
6. **Prompts** 탭 → 이름 클릭 → Versions 에서 편집 / 새 버전 / 라벨 이동.

프롬프트를 UI 에서 편집하고 `production` 라벨을 새 버전으로 옮기면, **코드 변경 없이** 다음 `pipeline.run(...)` 부터 새 프롬프트가 적용된다(로컬 `PROMPT` 상수는 fallback 으로 남겨둠).

---

## 5. 미구현 / 다음 단계

- fps, max_frames 같은 **입력 파라미터는 아직 trace metadata 에 안 붙음**. 현재는 analyzer 기본값(전역 1.0 / 로컬 2.0, max 180/30) 을 쓰고 있어서 실험 비교 시 수동 추적 필요. analyzer 의 `analyze(*, fps, max_frames)` 를 pipeline 까지 올리고 trace metadata 에 싣는 리팩터가 다음 작업.
- LLM-as-judge eval / Dataset 은 지금 시점에선 도입 보류. 관측 지표 기반 실험 비교로 충분.
- `video_duration_sec`, `pipeline_git_sha` 등 재현성 메타도 아직 미기록.

---

## 6. 파일 한눈에

| 파일 | 역할 |
|---|---|
| `ai/pipeline.py` | 메인 파이프라인. trace/span/metrics 집계. |
| `ai/llm_client.py` | Gemini 래퍼. Langfuse 연동, PromptHandle, UsageTracker, PRICING. |
| `ai/analyze_global.py` / `analyze_global_music.py` / `analyze_local_foley.py` / `analyze_local_non_foley.py` | 각 stage. `get_prompt` + `generate_content` 사용. 로컬 `PROMPT` 상수는 fallback. |
| `ai/seed_prompts.py` | 로컬 PROMPT → Langfuse 업로드. `--dry-run`, `--label`. |
| `ai/langfuse/docker-compose.yml` | Langfuse self-host (web/worker/postgres/clickhouse/redis/minio). |
| `ai/langfuse/README.md` | self-host 기동 가이드. |
| `ai/docs/langfuse_decision.md` | 왜 Langfuse 를 선택했는지. |
| `ai/docs/llm_observability_tools.md` | 후보 툴 비교. |
