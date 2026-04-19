# audio-classify × 기존 시스템 통합 분석

## 1. 현재 시스템 데이터 흐름

```
┌────────┐    ┌─────────────────────┐    ┌───────────────┐    ┌──────────────┐
│ Client │───→│ Backend (Node.js)   │───→│ Redis         │───→│ AI Server    │
│ React  │    │ Express + PostgreSQL│    │ job:request:* │    │ Python Worker│
└────────┘    └──────────┬──────────┘    └───────────────┘    └──────┬───────┘
                         │ S3 SDK                                     │
                         ▼                                            │
              ┌─────────────────────┐                                 │
              │      AWS S3         │    ← ── S3에서 영상 다운로드 ────┘
              │ - 원본 영상         │
              │ - 효과음 라이브러리 │    ← ★ 사운드 에셋이 여기에!
              │ - 최종 렌더링 영상  │
              └─────────────────────┘
```

### AI 서버의 현재 동작 (`pipeline.py`)

```
1. Redis에서 job 수신 (job_id, video_path)
2. S3에서 영상 다운로드
3. 글로벌 분석 → foley 분석 → non-foley 분석
4. 결과 패키징 → ★ 여기서 끝!
5. "효과음 매칭/검색은 backend (pgvector)에서 담당" ← pipeline.py 주석 원문
```

> [!IMPORTANT]
> **핵심 발견**: `pipeline.py` 9행에 명시적으로 이렇게 적혀 있습니다:
> ```python
> # 효과음 매칭/검색은 backend (pgvector)에서 담당.
> # AI는 분석 결과 JSON까지만 생성하여 backend로 넘긴다.
> ```
> 즉, **효과음 검색은 원래 백엔드(pgvector)에서 하기로 설계되어 있었습니다.**

---

## 2. 통합 지점 분석

### 📍 통합 지점 A — AI 서버 파이프라인 내부 (가장 자연스러움)

```
                    현재 파이프라인                    추가할 부분
                    ─────────────                    ────────────
    pipeline.run()
        │
        ├── 1. global_analyzing     (10~35%)
        ├── 2. foley_analyzing      (40~65%)
        ├── 3. non_foley_analyzing  (70~90%)
        ├── 4. _package()                           ← 여기까지 현재 구현
        │                                           
        └── 5. ★ sound_matching()   (90~100%)       ← audio-classify 호출 추가
                    │
                    ├── foley 이벤트 → retrieve_batch()
                    ├── sfx 이벤트 → retrieve_batch()
                    ├── ambience 이벤트 → retrieve_batch()
                    ├── cinematic 이벤트 → retrieve_batch()
                    └── 결과에 soundId 추가 → Redis/DB 저장
```

### 📍 통합 지점 B — 백엔드 pgvector (원래 설계)

```
    AI 서버 → 이벤트 JSON (soundId 없음) → Redis → 백엔드
                                                      │
                                                      ▼
                                              PostgreSQL + pgvector
                                              에서 임베딩 검색 실행
```

### 📍 통합 지점 C — 독립 마이크로서비스

```
    별도 REST API 서버로 audio-classify 배포
    백엔드 or AI 서버가 HTTP 호출로 검색
```

---

## 3. 필드 매핑 호환성 검증

### ✅ 호환: pipeline_result.json → EventQuery

| pipeline_result.json 필드 | audio-classify EventQuery 필드 | 호환 여부 |
|---|---|---|
| `event_id` | `event_id` | ✅ 동일 (E1, E2, ...) |
| `peak_time` | `peak_time` | ✅ 동일 (ms 단위) |
| `start_time` | `start_time` | ✅ 동일 |
| `end_time` | `end_time` | ✅ 동일 |
| `event_category` | `event_category` | ✅ 동일 (foley, sfx, ambience...) |
| `event_tags` | `event_tags` | ✅ 동일 (["Food_Drink:Chew"] 형식) |
| `description` | `description` | ✅ 동일 |
| `confidence` | `confidence` | ✅ 동일 |

> [!TIP]
> **필드가 100% 호환됩니다.** `pipeline_result.json`의 이벤트를 그대로 `EventQuery`에 넣을 수 있습니다. 변환 코드가 필요 없습니다.

### ⚠️ 비호환: Non-Foley 이벤트 형식 차이

Non-foley 트랙(sfx, ambience, cinematic, music, dialogue_vo)의 필드 이름이 약간 다릅니다:

| pipeline_result.json (non-foley) | EventQuery | 차이 |
|---|---|---|
| `track` | — | EventQuery에 없음 (event_category로 대체 가능) |
| `category_path` (배열) | `event_tags` (배열) | ⚠️ 형식 다름 |
| — | `event_id` | ⚠️ non-foley에는 event_id 없음 |

```json
// non-foley 이벤트 (pipeline_result.json)
{
  "track": "sfx",                          // → event_category로 매핑
  "start_time": 0.0,
  "end_time": 1.0,
  "category_path": ["SFX", "Cartoon", "Pop"],  // → event_tags로 매핑
  "description": "가벼운 팝업 효과음",
  "confidence": 0.8
  // ❌ event_id 없음
  // ❌ peak_time 없음
}
```

**해결 방안**: 간단한 어댑터 함수로 변환

```python
def adapt_non_foley_event(entry: dict, index: int) -> EventQuery:
    return EventQuery(
        event_id=f"{entry['track']}_{index}",     # 자동 생성
        peak_time=(entry["start_time"] + entry["end_time"]) / 2,
        start_time=entry["start_time"],
        end_time=entry["end_time"],
        event_category=entry["track"],
        event_tags=entry.get("category_path", []),  # 그대로 사용 가능
        description=entry["description"],
        confidence=entry.get("confidence", 0.5),
    )
```

---

## 4. 아키텍처 결정: 어디에 통합할 것인가?

### 옵션 비교

| 항목 | A: AI 서버 내부 | B: 백엔드 pgvector | C: 독립 서비스 |
|---|---|---|---|
| 구현 난이도 | 🟢 낮음 | 🟡 중간 | 🔴 높음 |
| 현재 코드 변경 | `pipeline.py` 에 5단계 추가 | 백엔드 TypeScript 코드 추가 | 새 서비스 배포 |
| DB 선택 | SQLite (이미 구현) | PostgreSQL + pgvector | 별도 DB |
| GPU 활용 | ⭕ Gemma 4 로컬 가능 | ❌ 백엔드에 GPU 없음 | 별도 GPU 서버 |
| S3 접근 | ⭕ `s3_client.py` 이미 있음 | ⭕ AWS SDK | ⭕ |
| 기존 설계와 호환 | ⚠️ 원래 설계와 다름 | ✅ 원래 설계 의도 | ⚠️ 추가 인프라 |
| 사운드 임베딩 사전 생성 | ⭕ 한번만 인덱싱 | ⚠️ pgvector 마이그레이션 필요 | ⭕ |

### 권장: 옵션 A (AI 서버 내부 통합)

> [!IMPORTANT]
> **옵션 A를 추천하는 이유:**
> 1. `pipeline.py`에 `_package()` 뒤에 한 단계만 추가하면 됨
> 2. `s3_client.py`가 이미 존재하여 S3에서 사운드 에셋 다운로드 가능
> 3. `redis_client.py`도 이미 있어 progress 업데이트 그대로 사용
> 4. Python ↔ Python이라 타입 변환 없음
> 5. GPU 서버에 배포되므로 Gemma 4 로컬 실행 가능

---

## 5. 주요 갭 3가지 + 해결 방안

### 갭 1: 사운드 에셋 사전 인덱싱

```
현재 상태:   audio-classify는 SQLite에 에셋이 인덱싱되어있다고 가정
실제 상태:   사운드 에셋은 S3 "효과음 라이브러리" 에 있음
필요한 것:  S3 → 다운로드 → Gemma 4 분류 → 임베딩 → DB 저장
```

**해결 방안**:
```python
# 1회성 인덱싱 스크립트 추가
def index_from_s3(bucket, prefix):
    files = s3_client.list_objects(bucket, prefix)
    for f in files:
        audio_bytes = s3_client.download_bytes(f.key)
        index_audio_from_bytes(audio_bytes, f.key, db)
```

이 인덱싱은 **한 번만** 실행하면 되며, 새 에셋 추가시에만 증분 인덱싱합니다.

### 갭 2: 결과에 `soundId` 필드 추가

```
현재 pipeline_result.json:
  { "event_id": "E1", "description": "...", "confidence": 0.9 }
                                                    ← soundId 없음!

아키텍처 §5에서 요구하는 최종 결과:
  { "type": "foley", "events": [{ "start": 0.0, "end": 5.5, "soundId": "..." }] }
                                                               ↑ soundId 필요!
```

**해결 방안**: `pipeline.py`의 `_package()` 후에 `soundId`를 채우는 단계 추가

```python
# pipeline.py에 추가
def _match_sounds(result: dict, db: Database) -> dict:
    """각 이벤트에 soundId를 매칭"""
    for track in ["foley", "sfx", "ambience", "cinematic"]:
        events = result.get(track, [])
        for event in events:
            retrieval = retrieve_for_event(EventQuery(**event), db)
            if retrieval.best_match:
                event["soundId"] = retrieval.best_match.asset_id
                event["alternatives"] = [
                    {"soundId": a.asset_id, "score": a.final_score}
                    for a in retrieval.alternatives
                ]
    return result
```

### 갭 3: 백엔드 PostgreSQL `sound_assets` 테이블과의 관계

```
아키텍처 §2:
  PostgreSQL에 "sound_assets" 테이블이 있음

audio-classify:
  SQLite "audio_assets" 테이블 사용 중
```

**해결 방안 (2가지)**:

| 방안 | 설명 | 작업량 |
|---|---|---|
| A) SQLite 유지 | AI 서버는 SQLite로 검색, `soundId`만 백엔드에 전달 | 🟢 최소 |
| B) pgvector 마이그레이션 | `db.py`를 PostgreSQL + pgvector로 교체 | 🟡 중간 |

**방안 A 추천**: AI 서버의 SQLite는 검색 인덱스 역할만 하고, `soundId`가 백엔드 PostgreSQL의 `sound_assets.id`와 매핑되면 충분합니다. 이때 `asset_id`를 S3 키 또는 백엔드 DB의 PK와 동일하게 설정하면 됩니다.

---

## 6. 통합 시 최소 변경사항

```diff
# pipeline.py 변경사항 (약 20줄)
 def run(job: dict) -> dict:
     ...
     result = _package(global_result, foley_result, non_foley_result)
+
+    # 5. 효과음 매칭
+    _progress(job_id, "matching", 92)
+    result = _match_sounds(result)
+    _progress(job_id, "placing", 97)
 
     _progress(job_id, "done", 100)
     return result
```

```diff
# worker.py 변경사항 (0줄)
# 변경 없음 — pipeline.run()의 결과에 soundId가 자동으로 포함됨
```

```diff
# redis_client.py 변경사항 (0줄)
# 변경 없음 — 기존 progress 체계 ("matching", 75%) 그대로 사용 가능
```

---

## 7. 결론

| 항목 | 상태 | 비고 |
|---|---|---|
| 이벤트 필드 호환성 | ✅ 100% | foley: 완전 호환, non-foley: 어댑터 1개 |
| Redis 통신 | ✅ 호환 | progress 체계 그대로 사용 |
| S3 파일 접근 | ✅ 호환 | `s3_client.py` 재활용 |
| 파이프라인 흐름 | ✅ 자연스러움 | `_package()` 뒤에 1단계 추가 |
| DB 구조 | ⚠️ 별도 | SQLite → pgvector 마이그레이션은 선택사항 |
| 사운드 에셋 인덱싱 | ⚠️ 사전 작업 필요 | S3에서 1회 인덱싱 스크립트 실행 |
| soundId 포맷 | ⚠️ 조율 필요 | 백엔드 `sound_assets` 테이블 ID 규격 확인 |

> [!TIP]
> **종합 판정: 통합 가능 (난이도 낮음)**
> 
> `pipeline.py`에 약 20줄 추가하면 기존 흐름에 자연스럽게 삽입됩니다.  
> 백엔드와 Redis 코드는 변경 불필요합니다.  
> 가장 큰 사전 작업은 **S3 사운드 라이브러리 인덱싱**(1회성)입니다.
