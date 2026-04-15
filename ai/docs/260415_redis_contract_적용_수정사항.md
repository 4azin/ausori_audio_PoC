# Redis 계약(`redis_contract.md`) 적용 — AI 워커 수정사항

작성: 2026-04-15
대상: `ai/` 모듈 전반 (`worker.py`, `redis_client.py`, `pipeline.py`, `analyze_*`, `config.py`)

백엔드가 내려준 `ai/redis_contract.md` 요구사항과 현재 AI 파이프라인 구현의 차이를 정리하고, 그에 따른 수정 항목을 우선순위 순으로 짚는다.

---

## 0. 한눈에 보는 차이 요약

| 영역 | 현재 구현 | 계약 요구 | 수정 필요 |
|---|---|---|---|
| Wire 포맷 | snake_case | **camelCase** | ✓ |
| 시간 단위 | foley=ms, non-foley=s 혼재 | **초(float) 통일** | ✓ |
| Job 요청 필드 | `job_id`, `video_path` 만 소비 | `jobId/projectId/userId/videoPath/videoMeta/requestedAt` | ✓ |
| Progress | `{job_id, status, progress}` | `{jobId, projectId, status, progress, currentStage, message, updatedAt}` | ✓ |
| Status enum | `global_analyzing / foley_analyzing / non_foley_analyzing / done / failed` | `pending / scene_splitting / analyzing / refining_timing / matching / placing / done / failed` | ✓ |
| 완료 통지 | **없음** (pipeline.run 리턴값만 존재) | **`XADD job:done`** 1건 | ✓ |
| 이벤트 구조 | 트랙별 6개 배열 (`foley/ambience/music/...`) | **단일 `events[]`** + 원소마다 `track` | ✓ |
| 카테고리 | foley: `event_category`(dict), non-foley: `category_path`(list) | 통일된 `categoryPath: string[3]` | ✓ |
| 식별자 페이로드 동봉 | 없음 | `jobId`, `projectId` 항상 포함 | ✓ |

---

## 1. `redis_client.py` — 키/스트림 I/O 전면 재작성

### 1-1. JobRequest 로더 (§2)
- `scan_pending_jobs()` / `get_job_request()` 의 리턴 dict 스키마를 camelCase 로 바꾸고, 내부 사용처(`worker.py`)는 `jobId/videoPath` 기준으로 접근.
- 권장: pydantic 모델 도입 (부록 A). `JobRequest.model_validate_json(raw)` 한 번으로 camel→snake 자동 매핑.

```python
# 새로 추가
class JobRequest(_Base):
    job_id: str
    project_id: int
    user_id: int
    video_path: str
    video_meta: VideoMeta
    requested_at: str
```

### 1-2. JobProgress 발행 (§3)
`set_progress(job_id, status, progress)` 의 저장 페이로드를 다음으로 변경:
```json
{
  "jobId": "...", "projectId": 42,
  "status": "analyzing", "progress": 35,
  "currentStage": "analyzing_soft",
  "message": "Scene 3/8 분석 중",
  "updatedAt": "2026-04-15T03:56:01.000Z"
}
```
시그니처도 확장:
```python
def set_progress(
    job_id: str, project_id: int, *,
    status: str, progress: int,
    current_stage: str | None = None,
    message: str | None = None,
) -> None: ...
```
`updatedAt` 은 내부에서 `datetime.now(timezone.utc).isoformat()` 으로 채운다.

### 1-3. JobDoneMessage 발행 (§4) — **신규 함수**
```python
def publish_job_done(payload: JobDoneMessage) -> str:
    return _client.xadd(
        "job:done",
        {"data": payload.model_dump_json(by_alias=True)},
    )
```
XADD field name = `data`, consumer group = `backend` (AI는 XACK 안 함).

### 1-4. cleanup 정책
AI 는 생성한 키를 직접 삭제하지 않는다. `job:request` / `job:progress` 의 수명은 백엔드가 관리(TTL 또는 소비 후 DEL). AI 는 JSON 을 제대로 뱉는 역할만. 기존 `cleanup()` 은 제거.

---

## 2. `worker.py` — JobRequest 필드 확장

- `job["job_id"]`, `job["video_path"]` → `job["jobId"]`, `job["videoPath"]` (또는 pydantic 모델 접근).
- S3 다운로드 시 `config.AWS_S3_BUCKET + videoPath` 로 조립 필요 (현재 `s3.download(video_path, ...)` 내부 처리 확인).
- 실패 분기에서 `set_progress(..., status="failed", message=str(e))` 로 에러 메시지 전파.
- 정상 종료 시 `publish_job_done(done_payload)` 호출.
- `pipeline.run(job)` 에 `jobId/projectId/videoPath` 전달. `projectId` 가 없던 시그니처이므로 pipeline 도 같이 수정.

---

## 3. `pipeline.py` — 완료 페이로드 빌드 + progress 스테이지 재정의

### 3-1. status 전이 재정의 (§0-4)
현재 하드코딩된 문자열:
```
global_analyzing → foley_analyzing → non_foley_analyzing → done
```
계약 enum 에 맞춰 매핑:
| 현재 | 계약 status | currentStage |
|---|---|---|
| 시작 | `pending` | `preprocessing` |
| global 시작 | `scene_splitting` | `global_scene_split` |
| foley/non_foley | `analyzing` | `analyzing_hard` / `analyzing_soft` |
| (후속) | `refining_timing` / `matching` / `placing` | (백엔드 단계) |
| 종료 | `done` | `done` |

AI 는 `scene_splitting / analyzing / done / failed` 까지만 쓰고, 나머지(`matching/placing`)는 백엔드가 이어서 갱신.

### 3-2. `_package()` 재설계 — **단일 `events[]`**
현재: `foley + NON_FOLEY_TRACKS` 6개 키를 top-level 로 리턴.
목표: 모든 원소를 `track` 필드 포함한 단일 리스트로 펴기.

```python
def _to_ai_events(foley_result, non_foley_result) -> list[dict]:
    out: list[dict] = []
    for e in (e for s in foley_result["scenes"] for e in s.get("events", [])):
        out.append({
            "track": "foley",
            "description": e["description"],
            "categoryPath": _flatten_foley_category(e["event_category"]),
            "startTime": _ms_to_sec(e["start_time"]),   # ms → s
            "endTime":   _ms_to_sec(e["end_time"]),
            "peakTime":  _ms_to_sec(e.get("peak_time")),
            "tags": e.get("event_tags", []),
            "mood": [], "energy": None, "texture": None,
            "confidence": e["confidence"],
        })
    for s in non_foley_result["scenes"]:
        for e in s.get("tracks", []):
            out.append({
                "track": e["track"],
                "description": e["description"],
                "categoryPath": e["category_path"],     # 이미 list
                "startTime": float(e["start_time"]),
                "endTime":   float(e["end_time"]),
                "mood": e.get("mood", []),
                "energy": e.get("energy"),
                "texture": e.get("texture"),
                "tags": e.get("tags", []),
                "confidence": e["confidence"],
            })
    out.sort(key=lambda x: x["startTime"])
    return out
```

### 3-3. foley `peak_time` 단위 확정
`analyze_local_foley.PROMPT` 가 peak_time 을 ms 로 뽑고 있는지 s 로 뽑고 있는지 현재 혼란. 계약은 **초**. 프롬프트와 후처리 둘 다 초로 통일(프롬프트 수정 + pipeline 변환 제거 중 택1; 프롬프트 쪽이 LLM 비용 0 이므로 권장).

### 3-4. foley `event_category` → `categoryPath`
현재 foley 출력은 `event_category: {major, mid, sub}` 같은 dict 로 추정. 계약은 `["Major","Mid","Sub"]` 배열. 프롬프트 스키마와 후처리 변환 중 한 곳에서 flatten.

### 3-5. JobDoneMessage 빌드
`pipeline.run()` 이 `publish_job_done` 에 넘길 최종 dict:
```python
{
  "jobId": job_id,
  "projectId": project_id,
  "completedAt": datetime.now(timezone.utc).isoformat(),
  "videoSummary": global_result["video_summary"],
  "videoContext": global_result["video_context"],
  "events": _to_ai_events(foley_result, non_foley_result),
  "telemetry": {
      "sceneCount": len(global_result["scenes"]),
      "llmUsage": usage["overall"],
      "metrics": metrics,
  },
}
```
기존 `llm_usage / metrics` top-level 키는 **제거**하고 `telemetry` 하위로 이동.

---

## 4. `analyze_local_foley.py` / `analyze_local_non_foley.py` 프롬프트

### 4-1. Foley
- `start_time / end_time / peak_time` 출력 단위를 **초 float** 로 명시.
- `event_category: {major,mid,sub}` → `categoryPath: [major, mid, sub]` 로 프롬프트 schema 변경 (또는 pipeline 후처리 flatten).
- `event_id` 제거 (계약상 의미 없음).
- `event_tags` → `tags` 로 필드명 통일.

### 4-2. Non-foley
- 이미 `track / category_path / start_time(초) / end_time / description / mood / energy / texture / tags / confidence` 구조이므로 거의 OK.
- snake→camel 은 wire 변환 레이어(pydantic)에서 처리하므로 프롬프트는 건드리지 않아도 됨.

---

## 5. `config.py` / `requirements.txt`

- pydantic 도입: `requirements.txt` 에 `pydantic>=2.7` 추가.
- taxonomy 로딩 경로 상수화: `TAXONOMY_PATH = "ai/taxonomy.json"` (§0-5, 매칭은 백엔드 책임이지만 AI 도 카테고리 유효성 검증용으로 로딩 가능).

---

## 6. AI 측 결정 사항 (백엔드 contract 하단에 함께 기록)

- **키 수명 관리 일임**: TTL/DEL 모두 백엔드 책임. AI 는 SET/XADD 만.
- **실패 시 `job:done` 미발행**: `JobProgress.status = "failed"` + `message` 로 종료.
- **`currentStage` 네이밍 고정**: `preprocessing` / `global_scene_split` / `analyzing_hard` / `analyzing_soft` / `done`.
- **foley 시간 전면 초(float)**: `startTime / endTime / peakTime` 모두 초. 프롬프트 단위 명시 + pipeline 후처리에서 ms→s 변환 없음.
- **`confidence` 필터링 위임**: AI 는 그대로 방출, 임계치 drop 은 백엔드.
- **`job:done` consumer group `backend`** 는 백엔드가 선 생성 (AI 는 그냥 XADD).

---

## 7. 작업 체크리스트 (우선순위)

1. [ ] `redis_client.py`: pydantic 모델 + `publish_job_done()` 신규, `set_progress()` 시그니처 확장
2. [ ] `worker.py`: camelCase 필드 접근, 실패 메시지 전달, `publish_job_done` 호출
3. [ ] `pipeline.py`: `_package()` → `_to_ai_events()` 단일 배열화, status enum 매핑, telemetry wrapping
4. [ ] `analyze_local_foley.py` 프롬프트: 초 단위, `categoryPath`, `tags` 로 통일
5. [ ] taxonomy 기반 categoryPath 유효성 검증 (실패 시 해당 event skip + 로그)
6. [ ] 통합 테스트: `back/0415_1_김선태_pipeline_result.json` 수준 영상으로 end-to-end 검증
7. [ ] 문서 업데이트: `260415_pipeline_실행법_및_Observation_구현사항.md` 에 신규 I/O 반영
