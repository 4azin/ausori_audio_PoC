# File API 전환 — Langfuse / 백엔드 호환성 / 추가 Trace 점검

> 작성일: 2026-04-16
> 대상: `analyze_global.py`, `analyze_local_foley.py`, `analyze_local_non_foley.py` → File API 전환 후

---

## 1. Langfuse 연동 현황 점검

### 변경 필요 없음 (호환 유지)

| 항목 | 상태 | 설명 |
|------|------|------|
| `start_trace` / `start_span` | OK | pipeline.py에서 호출, analyzer 변경과 무관 |
| `generate_content` 래퍼 | OK | contents에 file 객체가 들어와도 동일하게 동작 |
| `usage_metadata` 파싱 | OK | Gemini 응답 형식은 File API/인라인 동일 |
| 비용 계산 (`_price_for`) | OK | 토큰 기반 계산이라 입력 방식과 무관 |
| `_summarize_contents` | **수정 완료** | video file 객체 인식 추가 (`video_count` 필드) |

### 개선 가능 사항

1. **`gen_input`에 video 정보 추가** — 이미 `video_count` 반영 완료. Langfuse generation 기록에 영상 파일명도 남기면 디버깅에 유용.
2. **업로드 latency trace** — 현재 `generate_content`만 span으로 감싸고 있음. File API 업로드/삭제 시간은 추적 안 됨. (아래 §3 참고)

---

## 2. 백엔드 호환성 점검

### 와이어 포맷 (`JobDoneMessage`) — 변경 없음

AI → 백엔드 Redis 계약(`redis_contract.md`)의 데이터 흐름:

```
AI pipeline.run()
  → _build_done_message()
    → JobDoneMessage { jobId, projectId, completedAt, videoSummary, videoContext, events[], telemetry }
      → XADD job:done
        → 백엔드 job.consumer.ts → persistJobResult()
```

| 필드 | AI 출력 | 백엔드 소비 | 영향 |
|------|---------|------------|------|
| `events[]` | AiEvent 배열 (track, categoryPath, startTime 등) | enrichEvent → ai_events INSERT + vector search | **없음** — events 구조 변경 없음 |
| `videoSummary` | global 분석 결과 | project_analyses.video_summary | **없음** |
| `videoContext` | global 분석 결과 | project_analyses.video_context | **없음** |
| `telemetry` | `{ sceneCount, llmUsage, metrics }` | project_analyses.telemetry (JSONB) | **없음** — 자유 스키마 |

### telemetry 내용 변화

File API 전환 후 telemetry 값이 달라지는 부분:

| 지표 | 기존 (프레임 방식) | File API 방식 | 비고 |
|------|-------------------|--------------|------|
| `llmUsage.prompt` | 높음 (이미지 258 tok/장 × N) | 낮음 (영상 263 tok/초) | 토큰 수 감소 |
| `llmUsage.cost_usd` | ~$1.20 | ~$0.50~0.70 예상 | 비용 감소 |
| `llmUsage.cached` | 0 (캐시 미사용) | 0 (아직 캐시 미적용) | 추후 Context Caching 적용 시 변화 |

백엔드는 telemetry를 JSONB로 통째로 저장하므로 **스키마 영향 없음**.

### 주의사항

- `analyze_all()` 함수 시그니처에서 `fps`, `max_frames` 파라미터 제거됨
- pipeline.py에서 호출하는 부분은 이 파라미터를 사용하지 않으므로 **영향 없음**
- CLI 직접 실행 시 `--fps`, `--max-frames` 옵션이 사라졌으므로, 수동 테스트 스크립트가 있다면 업데이트 필요

---

## 3. 추가 Trace 제안

현재 Langfuse에 기록되는 것:

```
trace: ai-pipeline (job 단위)
  ├── span: global_analyzing
  │     └── generation: gemini:global
  ├── span: foley_analyzing
  │     └── generation: gemini:foley:scene1, scene2, ...
  └── span: non_foley_analyzing
        └── generation: gemini:non_foley:scene1, scene2, ...
```

### 제안 1: File API 업로드/삭제 시간 추적

File API 전환으로 **업로드 대기 시간**이 새로운 병목이 될 수 있음. 현재는 추적 안 됨.

```
trace: ai-pipeline
  ├── span: global_analyzing
  │     ├── span: video_upload          ← 신규
  │     ├── generation: gemini:global
  │     └── span: video_cleanup         ← 신규
  ├── span: foley_analyzing
  │     └── per scene:
  │           ├── span: video_upload     ← 신규
  │           ├── generation: gemini:foley:sceneN
  │           └── span: video_cleanup    ← 신규
```

**구현 방법**: `video_upload.py`의 `upload_video()`/`delete_video()`를 `llm_client.start_span()`으로 감싸거나, 함수 내부에서 직접 span을 열기.

### 제안 2: 업로드 메타데이터 기록

| 필드 | 설명 | 용도 |
|------|------|------|
| `file_size_bytes` | 업로드 파일 크기 | 업로드 시간과의 상관 분석 |
| `upload_latency_sec` | 업로드 + PROCESSING 대기 시간 | 병목 파악 |
| `gemini_file_name` | Gemini 파일 ID | 디버깅 |

### 제안 3: scene별 trim 시간 추적

현재 ffmpeg trim은 추적 안 됨. scene 수가 많으면 trim 누적 시간도 무시 못 함.

```
span: foley_analyzing
  └── per scene:
        ├── span: ffmpeg_trim           ← 신규
        ├── span: video_upload
        ├── generation: gemini:foley:sceneN
        └── span: video_cleanup
```

### 제안 4: telemetry에 input 방식 태그 추가

비용 최적화 전후를 비교하려면 telemetry에 어떤 방식으로 입력했는지 기록해두면 좋음.

```python
telemetry = {
    "sceneCount": ...,
    "llmUsage": ...,
    "metrics": ...,
    "inputMethod": "file_api",  # "inline_frames" | "file_api" | "file_api_cached"
}
```

백엔드 telemetry 컬럼이 자유 스키마(JSONB)라 필드 추가에 제약 없음.

### 제안 5: 전체 파이프라인 단계별 소요 시간

현재 Langfuse span으로 단계별 시간은 추적되지만, telemetry(Redis → 백엔드 DB)에는 LLM 호출 latency만 들어감. 파이프라인 전체 소요 시간 breakdown을 telemetry에도 넣으면 Langfuse 없이도 분석 가능.

```python
telemetry = {
    ...,
    "timing": {
        "global_sec": 12.3,
        "foley_sec": 45.6,
        "non_foley_sec": 38.2,
        "total_sec": 96.1,
        "upload_total_sec": 15.4,  # File API 업로드 누적
    },
}
```

---

## 4. 적용 우선순위

| 순위 | 항목 | 난이도 | 효과 |
|------|------|--------|------|
| 1 | telemetry에 `inputMethod` 태그 | 낮음 (1줄) | A/B 비교 필수 |
| 2 | upload/cleanup latency span | 낮음 | 새 병목 파악 |
| 3 | telemetry에 timing breakdown | 중간 | Langfuse 없이 분석 |
| 4 | 업로드 메타데이터 기록 | 낮음 | 디버깅 편의 |
| 5 | ffmpeg trim span | 낮음 | 완전성 |

---

## 5. 결론

- **Langfuse**: `_summarize_contents` video 인식 외에 **기존 코드 변경 불필요**. 추가 trace는 선택적.
- **백엔드 호환성**: `JobDoneMessage` 와이어 포맷 **변경 없음**. telemetry 값(토큰 수, 비용)만 달라지며, 자유 스키마이므로 문제 없음.
- **추가 trace**: File API 도입으로 생기는 새로운 구간(업로드 대기, 파일 삭제)을 추적하면 최적화 근거 확보에 유용.
