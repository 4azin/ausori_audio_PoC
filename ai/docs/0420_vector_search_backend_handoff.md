# 백엔드 벡터 검색 구현 전달 문서

## 1. 목적

현재 PoC는 두 폴더로 분리한다.

- `ai/custom_library`: 오디오 라이브러리 분석/인덱싱
- `ai/Vector_search_test`: 영상 이벤트 기반 벡터 검색

`Vector_search_test`는 외부 LLM 영상 분석 JSON을 읽고, 각 이벤트의 `description`을 임베딩한 뒤, 오디오 캡션 임베딩과 pgvector 유사도 비교를 수행하는 검색 PoC다.

운영 통합에서는 검색 로직을 백엔드가 담당하기로 했으므로, 백엔드는 `Vector_search_test`의 로직을 참고해 다음을 구현해야 한다.

- 오디오 AI 메타데이터 저장
- 오디오 캡션 임베딩 저장
- 영상 분석 이벤트 임베딩
- 이벤트별 후보 오디오 top-k 검색
- category/tags/class 기반 재랭킹
- 최종 `track_events` 생성

최종 목표는 A worker가 로컬 벡터 DB를 사용하지 않게 하는 것이다.

## 2. 현재 PoC 흐름

현재 전체 흐름은 두 단계로 나뉜다.

```text
custom_library:
1. S3 오디오 객체 목록 조회
2. gemini-audio-classify 결과 JSON 읽기
3. 오디오별 AI caption/tags를 로컬 DB에 저장
4. 오디오 caption을 임베딩해서 로컬 DB에 저장

Vector_search_test:
5. 외부 LLM 영상 분석 JSON 읽기
6. track별 event(description)를 저장
7. event description을 query embedding으로 변환
8. audio combined_caption embedding과 cosine similarity 검색
9. category/tags/class 신호로 재랭킹
10. retrieval_results에 후보군 저장
```

백엔드 운영 구현에서는 1~4는 오디오 라이브러리 인덱싱/마이그레이션 단계, 5~10은 프로젝트 분석 완료 후 matching 단계로 보면 된다.

## 3. 참고해야 할 파일

백엔드 구현 시 아래 파일을 기준으로 보면 된다.

| 파일 | 백엔드에서 참고할 내용 |
| --- | --- |
| `ai/custom_library/schema.sql` | 오디오 라이브러리 인덱싱용 PoC DB 구조. `audio_assets`, `audio_descriptions`, `audio_embeddings` 참고 |
| `ai/custom_library/load_audio_assets.py` | S3 객체와 AI 오디오 분석 결과 JSON을 매칭해서 오디오 description을 저장하는 방식 |
| `ai/custom_library/embed_audio_texts.py` | `short_caption`, `long_caption`, `combined_caption`을 만들고 document embedding을 저장하는 방식 |
| `ai/custom_library/s3_catalog.py` | S3 bucket/prefix에서 오디오 객체 목록을 읽는 방식 |
| `ai/custom_library/debug_s3_catalog.py` | S3 bucket/prefix 진단용 스크립트 |
| `ai/Vector_search_test/schema.sql` | 검색 PoC DB 구조. 영상 event/query embedding, retrieval result 구조 참고. 현재 PoC 호환을 위해 audio table도 포함 |
| `ai/Vector_search_test/load_video_events.py` | 외부 LLM 영상 분석 JSON에서 event를 추출하는 방식 |
| `ai/Vector_search_test/search_events.py` | 핵심 검색/재랭킹 로직 |
| `ai/Vector_search_test/embedding.py` | Gemini embedding 호출 방식. query/document task type 구분 참고 |
| `ai/redis_contract.md` | A worker가 백엔드에 전달하는 `JobDoneMessage` 구조 |
| `back/db/migrations/001_init.sql` | 기존 `sound_assets`, category, track 관련 기준 스키마 |
| `back/db/migrations/003_ai_events.sql` | 영상 분석 event 저장 테이블 |
| `back/db/migrations/004_project_analyses.sql` | 분석 원본 payload 저장 테이블 |
| `back/src/models/soundAsset.model.ts` | 기존 `sound_assets.embedding` 기반 vector search 참고 |

## 4. 백엔드로 넘어가야 하는 데이터

### 4-1. 오디오 자산 기준 데이터

이미 백엔드에 있는 기준 데이터:

```text
sound_assets.id
sound_assets.s3_key
sound_assets.file_name
sound_assets.original_path
sound_assets.major_id
sound_assets.mid_id
sound_assets.sub_id
sound_assets.duration
sound_assets.format
```

`sound_assets.id`가 운영상 오디오 자산의 canonical id가 되어야 한다.

### 4-2. 오디오 AI 메타데이터

B worker 또는 마이그레이션 스크립트가 백엔드에 넣어야 하는 데이터:

```jsonc
{
  "soundAssetId": 123,
  "llmSource": "gemini-audio-classify",
  "runName": "foley_batch_20260420",
  "primaryClass": "Foley",
  "secondClass": "Body",
  "classConfidence": 0.92,
  "shortCaptionEn": "A short human body sound.",
  "longCaptionEn": "A close dry human body movement sound with a brief comic texture.",
  "tagsStructured": {
    "temporal": "one_shot",
    "action": ["movement"],
    "texture": ["dry"]
  },
  "rawResultJson": {}
}
```

현재 PoC의 출처:

- `audio_descriptions.short_caption_en`
- `audio_descriptions.long_caption_en`
- `audio_descriptions.tags_structured`
- `audio_descriptions.raw_result_json`
- `audio_descriptions.primary_class`
- `audio_descriptions.second_class`
- `audio_descriptions.class_confidence`

### 4-3. 오디오 임베딩 데이터

오디오 description 하나당 여러 임베딩 target을 저장한다.

```jsonc
{
  "embeddingTarget": "combined_caption",
  "embeddingText": "short: ...\nlong: ...",
  "embeddingModel": "gemini-embedding-2-preview",
  "embeddingDim": 3072,
  "embedding": [0.001, -0.002]
}
```

현재 PoC의 embedding target:

- `short_caption`
- `long_caption`
- `combined_caption`

운영 검색 기본값은 `combined_caption`을 권장한다.

### 4-4. 영상 분석 이벤트 데이터

A worker가 `job:done`으로 전달하는 `events[]`가 검색 query의 원천이다.

예시:

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

백엔드는 이 이벤트를 `ai_events`에 저장하고, 각 event의 `description`을 query embedding으로 변환해 검색에 사용한다.

## 5. 권장 백엔드 DB 구조

기존 `sound_assets`에 모든 AI 데이터를 직접 추가하지 말고 별도 테이블로 분리하는 것을 권장한다.

### 5-1. 오디오 AI description 테이블

```sql
CREATE TABLE sound_asset_ai_descriptions (
    id                 BIGSERIAL PRIMARY KEY,
    sound_asset_id     BIGINT NOT NULL REFERENCES sound_assets(id) ON DELETE CASCADE,
    llm_source         TEXT NOT NULL,
    run_name           TEXT,
    primary_class      TEXT,
    second_class       TEXT,
    class_confidence   DOUBLE PRECISION,
    short_caption_en   TEXT NOT NULL,
    long_caption_en    TEXT NOT NULL,
    tags_structured    JSONB,
    raw_result_json    JSONB NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sound_asset_id, llm_source, run_name)
);

CREATE INDEX idx_sound_asset_ai_descriptions_asset_id
    ON sound_asset_ai_descriptions(sound_asset_id);

CREATE INDEX idx_sound_asset_ai_descriptions_primary_class
    ON sound_asset_ai_descriptions(primary_class);
```

### 5-2. 오디오 AI embedding 테이블

```sql
CREATE TABLE sound_asset_ai_embeddings (
    id                  BIGSERIAL PRIMARY KEY,
    ai_description_id   BIGINT NOT NULL REFERENCES sound_asset_ai_descriptions(id) ON DELETE CASCADE,
    embedding_target    TEXT NOT NULL,
    embedding_text      TEXT NOT NULL,
    embedding_model     TEXT NOT NULL,
    embedding_dim       INTEGER NOT NULL,
    embedding           vector(3072) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (embedding_target IN ('short_caption', 'long_caption', 'combined_caption')),
    CHECK (embedding_dim = 3072),
    UNIQUE (ai_description_id, embedding_target, embedding_model)
);

CREATE INDEX idx_sound_asset_ai_embeddings_description_id
    ON sound_asset_ai_embeddings(ai_description_id);
```

### 5-3. 선택: 검색 결과 감사 테이블

운영에서 후보군 디버깅이 필요하면 PoC의 `retrieval_results`에 해당하는 테이블을 추가할 수 있다.

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

운영 1차에서는 필수는 아니다. 다만 matching 품질을 검증해야 하면 저장하는 편이 좋다.

## 6. 오디오 데이터 적재 방식

현재 PoC에서는 `ai/custom_library/load_audio_assets.py`가 다음을 수행한다.

```text
S3 object list
+ gemini-audio-classify result JSON
-> filename 기준 매칭
-> audio_assets / audio_descriptions 저장
```

백엔드 운영에서는 filename 단독 매칭보다 아래 우선순위를 권장한다.

1. `sound_assets.s3_key`
2. `sound_assets.original_path`
3. `sound_assets.file_name`

`file_name`은 중복 가능성이 있으므로 마지막 fallback으로만 사용해야 한다.

권장 적재 흐름:

```text
1. 백엔드 sound_assets 카탈로그 export
   - id, s3_key, original_path, file_name
2. B worker 결과 JSON과 sound_assets를 매칭
3. sound_asset_ai_descriptions upsert
4. sound_asset_ai_embeddings upsert
5. combined_caption embedding 존재 여부 검증
```

현재 S3 기준 PoC 실행 결과:

```text
indexed s3 audio objects: 9044
processed result files: 44
upserted description rows: 4174
missing s3 objects: 0
```

즉 S3 파일명 기준으로는 현재 AI 결과 4174건이 모두 S3 객체와 매칭된 상태다.

## 7. 임베딩 규칙

현재 PoC는 Gemini embedding을 사용한다.

참고 파일:

- `ai/Vector_search_test/embedding.py`

규칙:

- 오디오 caption 임베딩: `task_type = RETRIEVAL_DOCUMENT`
- 영상 event query 임베딩: `task_type = RETRIEVAL_QUERY`
- embedding dimension: `3072`
- 현재 모델명: `.env`의 `EMBEDDING_MODEL`
- 현재 기본값: `gemini-embedding-2-preview`

오디오 `combined_caption` 생성 방식:

```text
short: {short_caption_en}
long: {long_caption_en}
```

참고 함수:

- `ai/Vector_search_test/utils.py`의 `build_combined_caption`
- `ai/Vector_search_test/embed_audio_texts.py`의 `EMBEDDING_TARGET_BUILDERS`

## 8. 검색 로직

핵심 구현은 `ai/Vector_search_test/search_events.py`를 참고한다.

현재 검색 단계:

```text
1. event.track을 source_group으로 매핑
2. event.description query embedding 생성
3. audio embedding 중 combined_caption만 조회
4. track/source_group hard filter
5. pgvector cosine distance로 top-k 후보 조회
6. category/tags/class confidence로 재랭킹
7. 최종 후보 저장 또는 track_event 생성
```

기본 SQL 형태:

```sql
SELECT
    sa.id AS sound_asset_id,
    sae.id AS audio_embedding_id,
    sad.primary_class,
    sad.second_class,
    sad.class_confidence,
    sad.short_caption_en,
    sad.long_caption_en,
    sad.tags_structured,
    (1 - (sae.embedding <=> $1::vector)) AS similarity
FROM sound_asset_ai_embeddings sae
JOIN sound_asset_ai_descriptions sad ON sad.id = sae.ai_description_id
JOIN sound_assets sa ON sa.id = sad.sound_asset_id
WHERE sae.embedding_target = 'combined_caption'
  AND sae.embedding_model = $2
  AND sa.major_id = $3
ORDER BY sae.embedding <=> $1::vector
LIMIT 10;
```

`$1`은 event description query embedding이다.

### 8-1. Track filter

PoC에서는 우선 `foley`, `sfx` 중심으로 실험했다.

운영 백엔드에서는 기존 enum과 맞춰 6개 track group을 지원하는 것이 좋다.

```text
ambience
cinematic
dialogue_vo
foley
sfx
music
```

track filter는 `sound_assets.major_id`와 category 테이블을 통해 적용하는 것을 권장한다.

예:

```text
event.track = "foley"
-> category_major.name = "Foley"
-> sound_assets.major_id = Foley id
```

단, `Hard_SFX`처럼 AI/파일 시스템 이름과 백엔드 category name이 다른 경우 매핑 테이블 또는 normalize 함수가 필요하다.

### 8-2. 재랭킹 점수

PoC의 final score:

```text
final_score =
  0.75 * similarity
+ 0.10 * category_score
+ 0.10 * tag_score
+ 0.05 * class_confidence
```

참고 함수:

- `score_category`
- `score_tags`
- `build_event_tokens`
- `build_audio_tokens`

초기 운영에서는 이 가중치를 그대로 쓰고, 검색 품질을 보면서 조정하는 것을 권장한다.

## 9. 프로젝트 분석 완료 후 백엔드 처리 순서

`redis_contract.md` 기준으로 A worker는 `job:done`에 `JobDoneMessage`를 발행한다.

백엔드 처리 권장 순서:

```text
1. job:done 수신
2. project_analyses에 raw payload 저장
3. events[]를 ai_events에 저장
4. 각 ai_event.description을 query embedding으로 변환
5. sound_asset_ai_embeddings에서 후보 top-k 검색
6. 재랭킹 수행
7. 최종 후보 1개 또는 N개 선택
8. track_groups / tracks / track_events 생성
9. projects.status = ready
10. Redis key cleanup / XACK
```

`ai_events`는 append-only 성격으로 유지하는 것이 좋다. 사용자가 트랙을 수정해도 AI 원본 이벤트는 남아 있어야 재검색/재추천에 활용할 수 있다.

## 10. 백엔드 구현 체크리스트

- [ ] `sound_asset_ai_descriptions` migration 추가
- [ ] `sound_asset_ai_embeddings` migration 추가
- [ ] 오디오 AI 메타데이터 import/upsert 스크립트 작성
- [ ] `combined_caption` 생성 규칙 확정
- [ ] embedding model name 확정
- [ ] `soundAssetModel` 또는 별도 repository에 AI embedding vector search 추가
- [ ] event description embedding 생성 로직 추가
- [ ] track/category 매핑 함수 추가
- [ ] 재랭킹 로직 추가
- [ ] optional: `ai_event_retrieval_results` 저장
- [ ] `job:done` consumer에서 새 검색 로직 연결

## 11. 백엔드와 AI가 맞춰야 할 결정 사항

1. B worker가 오디오 분석 시 `sound_assets.s3_key`를 직접 받을 수 있는가?
2. 백엔드 `sound_assets.original_path`가 원본 라이브러리 상대 경로를 보존하는가?
3. 운영 1차 검색 범위를 `foley/sfx`로 제한할 것인가, 6개 track 전체로 갈 것인가?
4. embedding model name을 무엇으로 고정할 것인가?
5. 백엔드가 event query embedding을 직접 만들 것인가, A worker가 만들어서 넘길 것인가?
6. 후보군 top-k를 저장할 것인가, 최종 선택된 `track_events`만 저장할 것인가?
7. `sound_assets.embedding` 기존 컬럼은 유지할 것인가, 새 AI embedding 테이블로 대체할 것인가?

## 12. 1차 권장안

1차 통합은 아래 방식이 가장 안전하다.

```text
A worker:
  영상 분석 event만 생성해서 job:done으로 전달

B worker / migration:
  오디오 AI caption, tags, embeddings를 백엔드 DB에 적재

Backend:
  event description embedding 생성
  sound_asset_ai_embeddings에서 combined_caption 검색
  재랭킹
  track_events 생성
```

이렇게 하면 운영 런타임에서 `Vector_search_test` 로컬 DB는 사용하지 않는다. `Vector_search_test`는 검색 알고리즘과 데이터 구조를 검증한 PoC/reference로만 남는다.
