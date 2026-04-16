# LLM Observability 툴 비교 (Gemini/파이프라인 관점)

비교 대상: Google Cloud 콘솔(기본 제공 메트릭) 은 제외하고, LLM trace / evaluation 을 전문으로 다루는 외부 툴들.
기준: 본 프로젝트(`ai/pipeline.py`, `google-genai` SDK, Python, 영상 분석 멀티모달)에서의 적합성.

---

## 1. Langfuse

오픈소스(Apache 2.0) LLM engineering platform. 호스팅/셀프호스팅 모두 지원.

**Pros**
- 오픈소스 — 온프레미스 self-host 가능(도커 한 줄). 데이터 주권/보안 이슈 없음.
- `@observe` 데코레이터 + OpenTelemetry 로 비침투적 연동. Gemini(`google-genai`) 도 OTel auto-instrument 됨.
- Trace tree UI 가 강력함: scene 별 호출을 nested span 으로 볼 수 있어 본 파이프라인(global → foley per-scene → non-foley per-scene) 시각화에 적합.
- 프롬프트 버전 관리, 프롬프트 실험(A/B), 데이터셋/평가, user feedback 수집까지 한 곳에서 처리.
- 무료 티어(hobby) 가 넉넉함.

**Cons**
- 셀프호스팅 시 Postgres + Clickhouse + Redis 필요 — 운영 부담.
- SaaS 는 EU/US 리전만. 한국 레이턴시 약간.
- Gemini 의 이미지/비디오 토큰 회계가 provider 별 파서에 맡겨져 있어, 최신 모델(gemini-3.x preview) 추가 시 가격표 오차 가능성 있음.

## 2. Arize Phoenix

오픈소스(Apache 2.0). OpenTelemetry 네이티브. Arize 의 제품군 중 OSS 라인.

**Pros**
- 완전 OSS + 로컬 실행이 간단 (`pip install arize-phoenix` → `phoenix.launch_app()`). 노트북/로컬 개발에 특히 편함.
- OpenInference 표준 스펙 제공 — Gemini/OpenAI/Anthropic 모두 동일 스키마로 수집.
- RAG evaluation, embedding drift 분석 등 "모델 품질" 지표가 강함.
- Jupyter/CLI 통합이 자연스러워 실험 단계에서 생산성 높음.

**Cons**
- 팀 단위 협업/장기 보관 기능은 상용 Arize AX 로 올라가야 완전함(SSO, 역할, 알림 등).
- 프롬프트 관리/배포 기능은 Langfuse 대비 약함.
- UI 가 "분석가" 지향이라, 운영 대시보드로 쓰기엔 단순.

## 3. Helicone

OpenSource(커뮤니티) + SaaS. 프록시 방식이 대표적 특징.

**Pros**
- **프록시 방식**: base URL 만 바꾸면 즉시 모든 호출이 기록됨 — 코드 변경 최소.
- 비용/캐싱/레이트리밋/사용자별 쿼터 등 "게이트웨이" 기능이 독보적.
- 가격표가 자동 업데이트되어 달러 환산 정확도 높음.
- 대시보드가 단순해서 비개발자도 보기 쉬움.

**Cons**
- 프록시 경유라 Gemini 의 일부 스트리밍/파일 업로드 경로는 async logger 모드로 써야 함 → 설정 추가 필요.
- Trace tree(span nested) 는 기본이 아니며 custom property 로 흉내내는 수준. 본 파이프라인처럼 구조적 호출 계층을 보기엔 Langfuse/Phoenix 만 못함.
- 셀프호스팅은 가능하지만 공식 지원은 SaaS 중심.

## 4. LangSmith (by LangChain)

SaaS. LangChain 생태계에 가장 최적화.

**Pros**
- LangChain/LangGraph 사용 시 제로 설정에 가깝게 trace 수집.
- Evaluation 기능(데이터셋, LLM-as-judge, human review) 성숙.
- 엔터프라이즈 고객/지원 체계 견고.

**Cons**
- **SaaS 전용** (self-host 는 enterprise 플랜 한정, 비쌈).
- LangChain 바깥(예: 순수 `google-genai` 호출)에서는 Langfuse/Phoenix 대비 이점이 적음.
- 가격이 호출/트레이스 단위라 scene-per-call 구조에서 비용이 빨리 오름.
- 벤더 락인 위험(LangChain 에 기대는 추상화가 많음).

## 5. Weights & Biases Weave

W&B 의 LLM 전용 tracing 제품.

**Pros**
- 이미 W&B 를 쓰는 ML 팀이면 실험/모델 트래킹과 자연스럽게 통합.
- `weave.op()` 데코레이터 방식이 직관적.
- 멀티모달(이미지/오디오/비디오) 객체 로깅이 강함 — **본 영상 파이프라인과 궁합 좋음**.

**Cons**
- W&B 계정/요금 체계 전제. 단독 도입 시 과할 수 있음.
- Self-host 제한적.
- Gemini/Google 생태계 integration 은 OpenAI 대비 정리가 덜 되어 있음.

## 6. OpenLLMetry (Traceloop)

OpenTelemetry 기반 오픈소스 SDK + SaaS.

**Pros**
- 완전 표준(OTel) — 어떤 OTel collector(Jaeger, Datadog, Grafana Tempo 등) 로도 전송 가능.
- 특정 벤더 락인 없음. 기존 사내 observability 인프라에 얹기 좋음.
- `google-genai` instrumentation 제공.

**Cons**
- SDK 는 좋지만 "UI/대시보드" 는 약함 — 결국 Jaeger/Grafana 를 직접 세팅해야 함.
- LLM-특화 기능(프롬프트 관리, eval) 은 없음. 순수 tracing.

## 7. Langtrace

오픈소스 tracing, OpenTelemetry 기반.

**Pros**
- 가볍고 OSS. 설치 간단.
- `google-genai` 포함 주요 SDK 자동 계측.
- 프롬프트 playground, annotation 기능 있음.

**Cons**
- 커뮤니티 규모가 Langfuse/Phoenix 대비 작음 → 이슈 해결 속도 느릴 수 있음.
- 고급 분석/평가 기능은 Langfuse 에 뒤짐.

---

## 선정 기준별 매트릭스

| 기준 | Langfuse | Phoenix | Helicone | LangSmith | Weave | OpenLLMetry | Langtrace |
|---|---|---|---|---|---|---|---|
| OSS / Self-host | 강 | 강 | 중 | 약(상용) | 약 | 강 | 강 |
| 코드 변경량 | 중(데코레이터) | 중 | **최소(프록시)** | 중(LC면 0) | 중 | 중 | 중 |
| Scene/계층형 trace UI | 강 | 강 | 약 | 강 | 중 | 중(뷰어별) | 중 |
| 프롬프트 관리 | 강 | 중 | 약 | 강 | 중 | 없음 | 중 |
| 평가/eval | 강 | 강 | 약 | 강 | 강 | 없음 | 중 |
| 멀티모달(영상/이미지) | 중 | 중 | 약 | 중 | **강** | 중 | 중 |
| Gemini 친화도 | 중 | 중 | 중 | 약 | 약 | 중 | 중 |
| 비용 | 무료티어 넉넉 | 무료(OSS) | 무료티어 | 비쌈 | W&B 과금 | 무료 | 무료티어 |

---

## 본 프로젝트 추천

1. **1순위: Langfuse (self-host)** — 파이프라인이 "global → scene 단위 반복" 구조라 nested trace UI 의 이점이 가장 크고, 프롬프트 버전 관리/평가까지 한 번에 커버. 현재 붙여둔 `llm_client.py` 의 `CallRecord` 를 OTel span 으로 전환하기만 하면 됨.
2. **2순위: Arize Phoenix** — 더 가볍게, 로컬 개발 중심으로 시작하고 싶다면. 나중에 Langfuse 로 이사하기도 쉬움(둘 다 OpenInference/OTel).
3. **보조: Weave** — 영상/이미지 asset 까지 실제로 UI 에서 들여다봐야 한다면 병행 고려.

Helicone/LangSmith 는 본 프로젝트 성격(멀티모달, 비-LangChain, 계층형)에는 덜 맞음.
