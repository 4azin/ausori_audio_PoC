# Langfuse 선정 근거

본 프로젝트(`ai/pipeline.py`, Gemini(`google-genai`) 기반 영상 분석 파이프라인)의 LLM observability 도구로 **Langfuse** 를 채택한다.

---

## 1. 결정 요약

| 항목 | 요구사항 | Langfuse |
|---|---|---|
| 프롬프트 버전 관리 | **필수** (4개 analyzer 의 PROMPT 상수를 코드 외부에서 관리하고 싶음) | ✅ 코어 기능 |
| 호출 트레이싱 / 토큰 회계 | 필수 (scene 단위 반복 구조 시각화) | ✅ Trace / Observation 모델 |
| Self-host 가능 | 강하게 선호 (데이터 주권, 비용) | ✅ MIT, Docker self-host |
| 비용/토큰 자동 집계 | 필수 | ✅ 자동 계산 + 대시보드 |
| 평가(LLM-as-judge, 사람 평가) | 중장기 필요 | ✅ Evaluations, Datasets |
| OpenTelemetry 호환 | 선호 (이식성) | ✅ OTel 지원 명시 |
| Gemini(`google-genai`) 지원 | 필수 | △ 공식 integration 목록엔 없음 — **OTel / 커스텀 SDK 경유로 가능** |

⇒ 나머지 후보 대비 "프롬프트 버전 관리 + self-host + trace UI" 세 축을 한 번에 충족하는 유일 선택지.

---

## 2. 핵심 근거

### 2.1 프롬프트 버전 관리 — 이번 결정의 결정타

본 파이프라인은 4개 analyzer 각각에 긴 PROMPT 상수를 박아두고 있다 (`analyze_global.py`, `analyze_global_music.py`, `analyze_local_foley.py`, `analyze_local_non_foley.py`). 프롬프트 튜닝이 잦고, 실험 간 비교가 필수인 단계이므로 **코드 변경 없이 프롬프트를 교체/롤백/A-B 테스트** 할 수 있어야 한다.

Langfuse 는 이걸 1급 시민으로 제공한다:

> "코드 외부에서 프롬프트를 관리할 수 있게 지원합니다. … 버전별 배포와 A/B 테스트가 가능합니다."
> — [wikidocs 293370 §Langfuse 프롬프트 관리](https://wikidocs.net/293370)

```python
prompt = langfuse.get_prompt("foley_analyzer_v3")
contents = [prompt.compile(scene_meta=...) ] + frame_parts
```

같은 축을 Arize Phoenix 에서 하려면 데이터셋/Experiment 기능을 짜서 흉내 내야 하고, OpenLLMetry/Langtrace 는 기능 자체가 없다. LangSmith 는 지원하지만 self-host 가 실질적으로 막혀 있다.

### 2.2 Self-host & 오픈소스 라이선스

- "MIT (오픈소스)" 라이선스 — [wikidocs 338733](https://wikidocs.net/338733)
- "Self-hosted (Docker, Kubernetes) & Cloud" — [langfuse/langfuse README](https://github.com/langfuse/langfuse)

사내 환경에 도커로 띄워 두면 Gemini 프롬프트/영상 메타데이터가 외부로 나가지 않는다. Phoenix 도 OSS 지만 협업/장기 보관 기능이 상용 Arize AX 로 올라가야 완전한 반면, Langfuse 는 OSS 단일 바이너리에서 팀 협업까지 포함된다.

### 2.3 Trace / Observation 모델이 본 파이프라인 구조와 맞음

Langfuse 의 데이터 모델:

> - **Trace**: 사용자 요청의 전체 실행 흐름
> - **Observation**: 트레이스 내 개별 작업 (Span, Generation, Event)
> — [wikidocs 293370](https://wikidocs.net/293370)

본 파이프라인은 `run(job)` 1회가 하나의 Trace, 그 안에 `global → foley(scene×N) → non_foley(scene×N)` 이 nested span 으로 떨어지는 자연스러운 계층 구조. 현재 `ai/llm_client.py` 의 `CallRecord` 를 그대로 Langfuse `generation` 이벤트로 맵핑 가능하다(stage, scene_id, prompt/output tokens, latency, cost).

### 2.4 평가 없이도 "관측 지표" 만으로 가치가 큼

본 프로젝트에는 **엄밀한 정답지가 존재하지 않는다.** 사운드는 주관적이고 `당근광고영상_정답지.mp4` 는 말만 정답지일 뿐 실제로는 참고용 유사 영상이다. 따라서 Langfuse 도입 목적은 "정답 대비 정확도 채점" 이 아니라, **실험 간 비교 가능한 관측 지표를 축적** 하는 쪽에 있다. 우리가 trace 당 찍어서 비교하고 싶은 것은 대략 다음과 같다.

| 축 | 구체 지표 | 기록 위치 |
|---|---|---|
| 결과 양 | Foley event 개수, 트랙별(ambience/music/cinematic/sfx/dialogue_vo) 배치 개수 | trace output / aggregated metric |
| 결과 상세도 | event 의 descriptor 필드 길이, mood/energy/texture 채움 비율 | trace output |
| 확신도 | 각 event/track entry 의 confidence 분포 (mean / p50 / min) | trace output |
| 입력 파라미터 | fps, max_frames, GEMINI_MODEL, scene 수, 영상 길이 | trace metadata / input |
| 프롬프트 | 각 analyzer 의 prompt 이름 + 버전 | generation input (prompt ref) |
| 호출량 | stage 별 호출 수, 총 호출 수 (scene 수가 많아지면 선형 증가) | trace span count |
| 토큰 / 비용 / 지연 | prompt/output/cached tokens, latency, USD | generation usage |

Langfuse 는 이 모든 필드를 trace/generation 의 `metadata`, `input`, `output`, `usage` 슬롯에 표준적으로 넣고 UI/SQL 로 비교할 수 있다. 즉 프롬프트 v3/v4, fps 1.0/2.0, max_frames 30/60 을 바꿔가며 같은 영상을 돌려본 뒤 **"event 수 평균, confidence 평균, 호출 수, 비용"** 을 나란히 보는 워크플로우가 그대로 나온다.

평가(LLM-as-judge, 사람 라벨링) 는 필요 시 추가로 붙일 수 있지만, 현재 단계에선 **관측 지표만으로도 충분히 실험 비교가 가능** 하다는 점이 중요하다.

> "LLM 판정, 사용자 피드백, 수동 레이블링, 커스텀 평가 파이프라인을 지원합니다."
> — [langfuse/langfuse README](https://github.com/langfuse/langfuse)

### 2.5 OpenTelemetry 호환 — 이식성 보험

Langfuse README 는 OpenTelemetry 지원을 명시한다. 나중에 다른 백엔드로 옮길 일이 생겨도 수집 코드를 거의 그대로 재사용 가능.

---

## 3. 왜 대안들을 탈락시켰나

### Arize Phoenix
AWS 블로그([링크](https://aws.amazon.com/ko/blogs/tech/monitoring-using-arize-phoenix-multi-agent-ai-system/))가 정리한 장점은 본 프로젝트에도 유효하다:

> "에이전트의 실행 경로의 모든 단계에 대한 가시성", "지연시간 병목 지점 즉시 식별", "토큰 사용량과 추정 비용 추적".

다만 동일 문서가 명시한 한계가 결정적:

> "수동 설정 필요 — `enableTrace=True` 파라미터를 직접 주입해야 함"
> "자체 모델 추적의 복잡성 — 커스텀 모델 사용 시 적절한 메타데이터 구성 필요"
> "인프라 구축 — Phoenix 수집 서버 자체 호스팅 필요"

즉 self-host 부담은 Langfuse 와 비슷한데 **프롬프트 버전 관리가 없다.** 이번 결정 기준에서 탈락.

### Helicone
프록시 방식이라 도입은 빠르지만 (1) scene 계층형 trace UI 약함, (2) 프롬프트 버전 관리 약함. 우리 요구에 미스매치.

### LangSmith
프롬프트 관리/eval 은 최상급이지만 **self-host 사실상 불가(enterprise only)** + LangChain 비사용 프로젝트라 이점 감소.

### Weave (W&B)
영상/이미지 asset UI 는 매력적이나 W&B 계정/과금 전제 + Gemini 통합 성숙도 낮음.

### OpenLLMetry / Langtrace
순수 tracing SDK. UI/프롬프트 관리/eval 은 별도 구축 필요 → 이번 결정 목적 미달.

---

## 4. 유일한 리스크 — Gemini 공식 integration 부재

Langfuse README 의 공식 integration 목록에는 OpenAI/LangChain/LlamaIndex/LiteLLM/Vercel AI SDK 등이 있고 **Google `google-genai` 은 들어있지 않다** (2026-04 확인).

해결 경로:
1. **OpenTelemetry 경로**: `opentelemetry-instrumentation-google-genai` (OpenLLMetry/Traceloop 제공) 로 자동 계측 → OTel exporter 를 Langfuse 로 보내기. Langfuse 는 OTel 수신을 공식 지원.
2. **수동 계측(권장 1차)**: 이미 만든 `ai/llm_client.py` 의 `generate_content` 래퍼에서 Langfuse Python SDK 로 `trace`/`generation` 을 직접 생성. 이미 `usage_metadata → prompt/output/cached tokens`, latency, cost 를 파싱하고 있어서 SDK 호출 몇 줄만 추가하면 끝난다.
3. **LiteLLM 경유**: Gemini 를 LiteLLM 에 얹으면 LiteLLM ↔ Langfuse 공식 integration 이 즉시 동작. 다만 LiteLLM 의존 추가.

1차로 (2) 수동 계측으로 가서 기능 검증 후, 필요하면 (1) OTel 로 리팩터링.

---

## 5. 다음 단계 (실행 계획 요약)

목표: **정답 채점이 아니라 "실험 간 비교 가능한 관측 지표 축적".**

1. **Langfuse self-host** — `docker compose` 로 로컬/사내 인스턴스 기동.

2. **`ai/llm_client.py` 에 Langfuse SDK 연동**
   - `pipeline.run(job)` 진입 시 `trace` 생성. `trace.metadata` 에 아래를 박는다:
     - `video_path`, `video_duration_sec`, `scene_count`
     - `fps_global`, `fps_local`, `max_frames_global`, `max_frames_local`
     - `GEMINI_MODEL` (stage 별로 다르면 분리)
     - `pipeline_git_sha` (재현성)
   - analyzer 별 `span` (`global`, `foley`, `non_foley`, `global_music`).
   - `generate_content` 호출마다 `generation` 기록:
     - `input`: compile 된 프롬프트 + scene meta (프레임 바이너리는 제외하고 개수/크기만)
     - `output`: Gemini raw JSON
     - `usage`: prompt/output/cached tokens (이미 파싱 중)
     - `metadata`: `stage`, `scene_id`, `frame_count`

3. **결과 기반 지표 산출 후 trace 에 attach** (`_package` 직후)
   - `foley_event_count`, 트랙별 배치 수 (`music_count` 등)
   - `confidence_mean`, `confidence_p50`, `confidence_min` (event + track 전체 묶어서, 그리고 stage 별로도)
   - `descriptor_avg_len`, `mood_fill_ratio`, `energy_fill_ratio`, `texture_fill_ratio` (non-foley)
   - `llm_call_count`, `llm_total_tokens`, `llm_total_cost_usd`, `llm_total_latency_sec` (이미 `UsageTracker.totals()` 에 있음)
   - → `langfuse.update_current_trace(output=..., metadata={"metrics": {...}})` 로 한 번에 붙임.

4. **프롬프트를 Langfuse Prompts 로 이관**
   - 4개 analyzer 의 `PROMPT` 상수를 각각 `global_analyzer`, `foley_analyzer`, `non_foley_analyzer`, `global_music_analyzer` 이름으로 등록.
   - 런타임: `prompt_obj = langfuse.get_prompt("foley_analyzer")` → `compile(...)` → `generate_content` 의 `prompt` 인자로 `prompt_obj` 를 함께 넘겨 **generation ↔ prompt 버전 링크** 생성.
   - 이렇게 해두면 UI 에서 "이 버전 프롬프트로 돌린 trace 들의 event_count 평균" 을 한 번에 뽑을 수 있다.

5. **실험 세션 템플릿화**
   - `session_id = f"{video_name}:{date}"` 로 묶어 같은 영상·다른 설정 실험을 한 세션에서 비교.
   - 체크리스트: prompt version, fps, max_frames, model 을 바꿔가며 같은 영상을 돌리고 위 metrics 가 어떻게 움직이는지 관찰.

---

## 출처

- [wikidocs 338733 — LLM 관찰성 도구 비교](https://wikidocs.net/338733)
- [wikidocs 293370 — Langfuse 개요/프롬프트 관리](https://wikidocs.net/293370)
- [AWS 블로그 — Arize Phoenix 를 활용한 멀티에이전트 모니터링](https://aws.amazon.com/ko/blogs/tech/monitoring-using-arize-phoenix-multi-agent-ai-system/)
- [langfuse/langfuse (GitHub)](https://github.com/langfuse/langfuse)
