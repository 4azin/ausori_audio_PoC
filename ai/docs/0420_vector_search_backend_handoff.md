# Vector Search 백엔드 구현 전달 문서

## 1. 목적

이 문서는 `ai/Vector_search_test`에 남겨둘 검색 PoC 로직을 백엔드가 운영 코드로 옮기기 위해 필요한 정보를 정리한다.

`Vector_search_test`의 책임은 아래 5~10단계다.

```text
5. 외부 LLM 영상 분석 JSON 읽기
6. track별 event(description) 저장
7. event description을 query embedding으로 변환
8. audio combined_caption embedding과 cosine similarity 검색
9. category/tags/class 신호로 재랭킹
10. retrieval_results에 후보군 저장
```

오디오 샘플 자체를 분석하고, S3 오디오 객체와 AI caption/embedding을 준비하는 1~4단계는 `ai/custom_library` 책임이다. 해당 내용은 별도 문서인 `0420_custom_library_backend_contract.md`를 참고한다.

운영 목표:

- A worker는 영상 분석 event를 만든다.
- 백엔드는 event description을 query embedding으로 변환한다.
- 백엔드는 `sound_asset_ai_embeddings`의 오디오 caption embedding과 유사도 검색을 수행한다.
- 백엔드는 재랭킹 후 `track_events`를 생성한다.
- 운영 런타임에서는 `Vector_search_test` 로컬 DB를 사용하지 않는다.

## 2. 참고 파일

| 파일 | 백엔드 구현 시 참고할 내용 |
| --- | --- |
| `ai/Vector_search_test/load_video_events.py` | 외부 LLM 영상 분석 JSON에서 `events[]`를 추출하는 방식 |
| `ai/Vector_search_test/search_events.py` | 핵심 검색 SQL, cosine similarity, 재랭킹 로직 |
| `ai/Vector_search_test/embedding.py` | Gemini query embedding 호출 방식 |
| `ai/Vector_search_test/utils.py` | token normalize, JSON token flatten, vector literal 변환 |
| `ai/Vector_search_test/schema.sql` | `video_query_events`, `video_query_embeddings`, `retrieval_results` PoC 구조 |
| `ai/redis_contract.md` | A worker가 `job:done`으로 전달하는 `JobDoneMessage` 구조 |
| `back/db/migrations/003_ai_events.sql` | 백엔드의 영상 분석 event 저장 테이블 |
| `back/db/migrations/004_project_analyses.sql` | 백엔드의 분석 raw payload 저장 테이블 |
| `back/src/models/soundAsset.model.ts` | 기존 pgvector 검색 코드 스타일 참고 |

## 3. 백엔드가 받는 입력

A worker가 `job:done` stream으로 전달하는 `JobDoneMessage.events[]`가 검색 입력이다.

검색에 필요한 event 필드:

```jsonc
{
  "track": "foley",
  "description": "A short dry footstep on gravel.",
  "categoryPath": ["Foley", "Footstep", "Gravel"],
  "startTime": 9.5,
  "endTime": 10.2,
  "peakTime": 9.8,
  "mood": [],
  "energy": "medium",
  "texture": "one_shot",
  "tags": ["footstep", "gravel", "dry"],
  "confidence": 0.82
}
```

필수:

- `track`
- `description`
- `startTime`
- `endTime`

검색/재랭킹에 권장:

- `categoryPath`
- `tags`
- `confidence`
- `peakTime`

## 4. 백엔드 내부 저장 위치

영상 분석 결과는 기존 백엔드 테이블을 사용한다.

### 4-1. `project_analyses`

`JobDoneMessage` 전체 원본을 `raw_payload`로 저장한다.

저장 목적:

- 재처리
- 디버깅
- LLM 비용/품질 추적
- event schema 변경 대응

### 4-2. `ai_events`

각 `events[]` 원소를 `ai_events`에 저장한다.

현재 `003_ai_events.sql` 기준 주요 필드:

```text
id
project_id
analysis_id
group_type
description
embedding
suggested_start_time
suggested_end_time
analysis_batch
created_at
```

권장 매핑:

| JobDone event | ai_events |
| --- | --- |
| `track` | `group_type` |
| `description` | `description` |
| query embedding | `embedding` |
| `startTime` | `suggested_start_time` |
| `endTime` | `suggested_end_time` |
| analysis batch | `analysis_batch` |

## 5. Query Embedding 규칙

백엔드는 event의 `description`을 query embedding으로 변환한다.

참고 파일:

- `ai/Vector_search_test/embedding.py`

규칙:

```text
task_type = RETRIEVAL_QUERY
embedding_dim = 3072
embedding_model = 백엔드/AI가 합의한 모델명
```

현재 PoC 기본값:

```text
gemini-embedding-2-preview
```

주의:

- 오디오 caption embedding은 `RETRIEVAL_DOCUMENT`
- 영상 event description embedding은 `RETRIEVAL_QUERY`

두 task type을 구분해야 검색 품질이 안정적이다.

## 6. 검색 대상 DB

백엔드 검색 대상은 `sound_assets.embedding`이 아니라 `custom_library` 문서에서 제안한 다음 테이블이다.

```text
sound_asset_ai_descriptions
sound_asset_ai_embeddings
```

운영 검색 기본값:

```text
embedding_target = 'combined_caption'
```

`combined_caption` 생성 규칙:

```text
short: {short_caption_en}
long: {long_caption_en}
```

## 7. 기본 검색 SQL

event description query embedding을 `$1::vector`로 넘긴다.

```sql
SELECT
    sa.id AS sound_asset_id,
    sa.duration,
    sae.id AS audio_embedding_id,
    sad.primary_class,
    sad.second_class,
    sad.class_confidence,
    sad.short_caption_en,
    sad.long_caption_en,
    sad.tags_structured,
    (1 - (sae.embedding <=> $1::vector))::real AS similarity
FROM sound_asset_ai_embeddings sae
JOIN sound_asset_ai_descriptions sad ON sad.id = sae.ai_description_id
JOIN sound_assets sa ON sa.id = sad.sound_asset_id
WHERE sae.embedding_target = 'combined_caption'
  AND sae.embedding_model = $2
  AND sa.major_id = $3
ORDER BY sae.embedding <=> $1::vector
LIMIT $4;
```

파라미터:

```text
$1 = event description query embedding
$2 = embedding model name
$3 = event.track에 대응하는 category_major.id
$4 = 후보 개수, 예: 10
```

## 8. Track / Category Filter

운영에서는 백엔드의 `track_group_type` enum과 맞춘다.

```text
ambience
cinematic
dialogue_vo
foley
sfx
music
```

권장 방식:

```text
event.track
-> category_major.name 또는 별도 매핑 테이블
-> category_major.id
-> sound_assets.major_id filter
```

예시:

```text
event.track = "foley"
-> category_major.name = "Foley"
-> sound_assets.major_id = Foley id
```

주의:

- 파일 시스템/AI 쪽 이름과 백엔드 taxonomy 이름이 다를 수 있다.
- 예: `Hard_SFX`, `SFX`, `sfx`
- 백엔드에 normalize 함수 또는 매핑 테이블이 필요하다.

## 9. 재랭킹 로직

PoC 참고 파일:

- `ai/Vector_search_test/search_events.py`

현재 점수식:

```text
final_score =
  0.75 * similarity
+ 0.10 * category_score
+ 0.10 * tag_score
+ 0.05 * class_confidence
```

### 9-1. `similarity`

pgvector cosine similarity:

```sql
1 - (audio_embedding <=> query_embedding)
```

### 9-2. `category_score`

PoC 기준:

- event의 `categoryPath`에 오디오 `primary_class`가 있으면 `+0.5`
- event의 `categoryPath`에 오디오 `second_class`가 있으면 `+0.5`
- 최대 `1.0`

### 9-3. `tag_score`

PoC 기준:

- event `description`, `categoryPath`, `tags`에서 token set 생성
- audio `primary_class`, `second_class`, captions, `tags_structured`에서 token set 생성
- overlap 비율을 사용

### 9-4. `class_confidence`

오디오 AI 분석 결과의 `class_confidence`를 사용한다.

없으면 `0.0`으로 처리한다.

## 10. Optional: 검색 결과 저장 테이블

운영 1차에서 반드시 필요하지는 않지만, 후보군 품질 디버깅을 위해 저장을 권장한다.

```sql
CREATE TABLE ai_event_retrieval_results (
    id                  BIGSERIAL PRIMARY KEY,
    ai_event_id          BIGINT NOT NULL REFERENCES ai_events(id) ON DELETE CASCADE,
    sound_asset_id       BIGINT NOT NULL REFERENCES sound_assets(id) ON DELETE CASCADE,
    audio_embedding_id   BIGINT REFERENCES sound_asset_ai_embeddings(id) ON DELETE SET NULL,
    rank_order           INTEGER NOT NULL,
    similarity           DOUBLE PRECISION NOT NULL,
    track_match_score    DOUBLE PRECISION,
    category_match_score DOUBLE PRECISION,
    tag_match_score      DOUBLE PRECISION,
    final_score          DOUBLE PRECISION NOT NULL,
    scoring_version      TEXT NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

저장하면 좋은 이유:

- top-1 선택 실패 원인 분석
- ranking weight 조정 근거 확보
- event별 후보군 재검토
- 프론트/운영자 리뷰 기능 확장 가능

## 11. `job:done` 이후 백엔드 처리 순서

권장 처리 순서:

```text
1. Redis `job:done` 수신
2. `project_analyses`에 raw payload 저장
3. `events[]`를 `ai_events`에 저장
4. 각 `ai_events.description`을 query embedding으로 변환
5. `sound_asset_ai_embeddings`에서 후보 top-k 검색
6. category/tags/class 기반 재랭킹
7. 최종 후보 선택
8. `track_groups` / `tracks` / `track_events` 생성
9. `projects.status = ready`
10. Redis key cleanup / XACK
```

## 12. 백엔드 구현 체크리스트

- [ ] `job:done` consumer에서 `project_analyses` 저장
- [ ] `events[]` -> `ai_events` bulk insert
- [ ] event description query embedding 생성
- [ ] `track` -> `category_major.id` 매핑
- [ ] `sound_asset_ai_embeddings` 기반 vector search
- [ ] 재랭킹 로직 구현
- [ ] 최종 후보를 `track_events.sound_asset_id`에 연결
- [ ] optional: `ai_event_retrieval_results` 저장
- [ ] 검색 실패 시 fallback 정책 정의

## 13. 백엔드와 AI가 맞춰야 할 사항

1. query embedding을 백엔드가 만들지, A worker가 만들어서 넘길지
2. embedding model name을 무엇으로 고정할지
3. 검색 후보 top-k 기본값을 몇 개로 할지
4. 운영 1차에서 `foley/sfx`만 할지, 6개 track 전체를 할지
5. 후보가 없을 때 track_event를 생략할지, fallback asset을 쓸지
6. `ai_event_retrieval_results`를 운영 DB에 저장할지

## 14. 1차 권장안

```text
A worker:
  영상 분석 event만 `job:done`으로 전달

Backend:
  event description embedding 생성
  `sound_asset_ai_embeddings`에서 `combined_caption` 검색
  재랭킹
  최종 sound_asset_id 선택
  track_events 생성
```

이 구조에서는 `Vector_search_test`는 운영 런타임에 사용되지 않고, 백엔드 검색 구현을 위한 reference 코드로만 남는다.

