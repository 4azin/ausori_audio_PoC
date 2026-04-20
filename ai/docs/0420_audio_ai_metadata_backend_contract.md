# 오디오 AI 메타데이터 백엔드 통합 제안서

## 1. 목적

이 문서는 A worker의 벡터 검색 흐름을 기존 백엔드 오디오 카탈로그와 통합하기 위해 필요한 백엔드 DB 계약을 제안한다.

현재 상태:

- 백엔드는 원본 오디오 파일을 S3에 저장한다.
- 백엔드는 PostgreSQL의 `sound_assets` 테이블에 오디오 기본 메타데이터를 저장한다.
- A worker / `Vector_search_test`는 현재 로컬 PostgreSQL DB를 바라보고 있으며, 여기에 AI가 생성한 오디오 캡션, 구조화 태그, 임베딩이 저장되어 있다.
- `redis_contract.md`에는 이미 백엔드와 AI worker 사이의 프로젝트 영상 분석 job 계약이 정의되어 있다.

목표:

- `sound_assets`를 오디오 자산의 기준 테이블로 유지한다.
- AI가 생성한 오디오 메타데이터를 `sound_assets.id`에 연결한다.
- 백엔드 벡터 검색이 로컬 `Vector_search_test` DB가 아니라 백엔드 DB의 AI 캡션/임베딩을 사용하게 한다.
- 재처리, 디버깅, 재랭킹을 위해 AI 원본 응답을 보존한다.

## 2. Worker 역할 분리

예정된 AI worker는 2개다.

| Worker | 폴더 범위 | 책임 |
| --- | --- | --- |
| A worker | `video-analysis`, `Vector_search_test` | 전체 영상 AI 파이프라인, 영상 이벤트 추출, 사운드 매칭, Redis job 처리 |
| B worker | `gemini-audio-classify`, `audio-classify` | 커스텀 오디오 라이브러리 분석, 캡션/태그 생성, 오디오 임베딩 준비 |

이 문서는 우선 A worker 통합에 필요한 백엔드 스키마에 집중한다.

중요한 책임 분리:

- B worker는 오디오 쪽 AI 메타데이터를 생성하거나 갱신한다.
- A worker는 프로젝트 분석/매칭 중 오디오 쪽 AI 메타데이터를 조회해서 사용한다.
- 백엔드는 기준 메타데이터를 저장해서 A worker가 별도 로컬 DB에 의존하지 않게 한다.

## 3. 기존 백엔드 테이블

백엔드에는 이미 다음 테이블이 있다.

- `sound_assets`
  - 기준 오디오 자산 테이블.
  - `id`, `s3_key`, `file_name`, `major_id`, `mid_id`, `sub_id`, `mood`, `tags`, `description`, `duration`, `format`, `embedding` 등을 포함한다.
- `ai_events`
  - 프로젝트/영상 분석으로 생성된 AI 이벤트 후보.
  - 영상 이벤트 설명과 이벤트 임베딩을 저장한다.
- `project_analyses`
  - `job:done` 전체 payload 원본을 저장한다.

현재 빠져 있는 부분은 오디오 자산 자체에 대한 AI 메타데이터다. 이 데이터는 현재 `Vector_search_test` 로컬 DB에서 다음 테이블로 관리되고 있다.

- `audio_descriptions`
- `audio_embeddings`

## 4. 권장 데이터 모델

AI 오디오 메타데이터를 전부 `sound_assets`에 직접 넣는 방식은 권장하지 않는다.

이유:

- `sound_assets`는 기준 오디오 메타데이터 테이블이다.
- AI 메타데이터는 모델, 실행 버전, 프롬프트 변경에 따라 여러 번 재생성될 수 있다.
- `short_caption`, `long_caption`, `combined_caption`처럼 여러 임베딩 대상을 분리해서 저장해야 한다.
- 추후 감사, 디버깅, 마이그레이션을 위해 원본 AI 응답을 보존해야 한다.

백엔드에 아래 테이블 추가를 제안한다.

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

```sql
CREATE TABLE sound_asset_ai_embeddings (
    id                     BIGSERIAL PRIMARY KEY,
    ai_description_id       BIGINT NOT NULL REFERENCES sound_asset_ai_descriptions(id) ON DELETE CASCADE,
    embedding_target        TEXT NOT NULL,
    embedding_text          TEXT NOT NULL,
    embedding_model         TEXT NOT NULL,
    embedding_dim           INTEGER NOT NULL,
    embedding               vector(3072) NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (embedding_target IN ('short_caption', 'long_caption', 'combined_caption')),
    CHECK (embedding_dim = 3072),
    UNIQUE (ai_description_id, embedding_target, embedding_model)
);

CREATE INDEX idx_sound_asset_ai_embeddings_description_id
    ON sound_asset_ai_embeddings(ai_description_id);
```

선택적으로 `sound_assets`에 상태 컬럼을 추가할 수 있다.

```sql
ALTER TABLE sound_assets
    ADD COLUMN ai_metadata_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (ai_metadata_status IN ('pending', 'ready', 'failed', 'stale'));

ALTER TABLE sound_assets
    ADD COLUMN ai_metadata_updated_at TIMESTAMPTZ;
```

## 5. 로컬 Vector DB와 백엔드 매핑

| 로컬 `Vector_search_test` | 백엔드 제안 |
| --- | --- |
| `audio_assets` | `sound_assets` |
| `audio_assets.asset_key` | 가능하면 `sound_assets.s3_key` 또는 `sound_assets.original_path`와 매핑 |
| `audio_assets.original_filename` | `sound_assets.file_name` fallback. 단, 중복 파일명 가능성 때문에 마지막 수단 |
| `audio_descriptions` | `sound_asset_ai_descriptions` |
| `audio_embeddings` | `sound_asset_ai_embeddings` |
| `video_query_events` | 런타임 프로젝트 측 `ai_events` / `project_analyses.raw_payload` |
| `video_query_embeddings` | `ai_events.embedding` |
| `retrieval_results` | 운영 1차에서는 필수 아님. 디버깅/평가용으로 선택 가능 |

가장 안전한 연결 키 우선순위:

1. B worker가 S3 key를 알고 있다면 `sound_assets.s3_key`
2. 원본 라이브러리 상대 경로가 보존된다면 `sound_assets.original_path`
3. 마지막 수단으로 `sound_assets.file_name`

단, `file_name`은 같은 이름의 파일이 여러 개 있을 수 있으므로 단독 매칭 키로 쓰기에는 위험하다.

백엔드는 B worker 또는 마이그레이션 스크립트가 사용할 수 있도록 다음 형태의 오디오 카탈로그를 제공하는 것이 좋다.

```jsonc
[
  {
    "soundAssetId": 123,
    "s3Key": "audio/Foley/Object_handling/Box/cardboard_box.wav",
    "originalPath": "Foley/Object_handling/Box/cardboard_box.wav",
    "fileName": "cardboard_box.wav",
    "categoryPath": ["Foley", "Object_handling", "Box"]
  }
]
```

## 6. A worker / 백엔드 매칭 쿼리 방향

현재 로컬 검색 흐름:

1. `track` 기준 hard filter: 우선 `foley`, `sfx`
2. 영상 이벤트 `description` 임베딩과 오디오 `combined_caption` 임베딩 비교
3. `categoryPath`, `tags`, class label로 재랭킹

백엔드에서는 `sound_assets`와 새 AI 임베딩 테이블을 조인해서 검색한다.

```sql
SELECT
    sa.id AS sound_asset_id,
    sa.duration,
    sad.primary_class,
    sad.second_class,
    sad.class_confidence,
    sad.tags_structured,
    (1 - (sae.embedding <=> $1::vector))::real AS similarity
FROM sound_asset_ai_embeddings sae
JOIN sound_asset_ai_descriptions sad ON sad.id = sae.ai_description_id
JOIN sound_assets sa ON sa.id = sad.sound_asset_id
JOIN category_major cm ON cm.id = sa.major_id
WHERE cm.name = $2
  AND sae.embedding_target = 'combined_caption'
  AND sae.embedding_model = $3
ORDER BY sae.embedding <=> $1::vector
LIMIT $4;
```

운영 1차 권장안:

- 오디오 임베딩 검색 대상은 `combined_caption`을 기본으로 한다.
- 영상 이벤트 쿼리 텍스트는 `description`을 기본으로 한다.
- 먼저 major category 또는 track group으로 후보를 좁힌다.
- `categoryPath`, `tags`, `primary_class`, `second_class`, `tags_structured`는 재랭킹 신호로 사용한다.

## 7. Redis 계약 영향

1차 통합에서는 `redis_contract.md`를 크게 바꿀 필요는 없다.

기존 흐름:

1. 백엔드가 `job:request:{jobId}`로 `JobRequest`를 등록한다.
2. A worker가 S3에서 영상을 다운로드하고 분석한다.
3. A worker가 `job:done`으로 `JobDoneMessage`를 보낸다.
4. 백엔드는 프로젝트 분석 원본과 프로젝트 측 AI 이벤트를 저장한다.
5. 백엔드가 벡터 검색을 수행하고 `track_events`를 생성한다.

권장 책임 변경:

- 백엔드의 벡터 검색은 `sound_assets.embedding`만 보지 말고 `sound_asset_ai_embeddings`를 조회해야 한다.
- `sound_assets.embedding`은 기존 단순 검색/레거시 용도로 남길 수 있지만, 운영 매칭은 새 오디오 AI 임베딩 테이블을 사용하는 것을 권장한다.

## 8. 마이그레이션 / Import 흐름

로컬 A/B worker DB의 데이터를 백엔드로 옮기는 권장 흐름:

1. 백엔드가 `sound_assets` 카탈로그를 export한다.
   - `id`, `s3_key`, `original_path`, `file_name`
2. AI 쪽에서 로컬 `audio_assets` row를 백엔드 `sound_assets.id`와 매핑한다.
3. AI 쪽에서 description/embedding 데이터를 JSONL 또는 CSV로 export한다.
4. 백엔드가 `sound_asset_ai_descriptions`에 import한다.
5. 백엔드가 `sound_asset_ai_embeddings`에 import한다.
6. 백엔드가 다음을 검증한다.
   - 모든 AI row가 유효한 `sound_asset_id`를 가진다.
   - embedding dimension이 3072다.
   - 운영 검색 대상 오디오에는 `combined_caption`이 존재한다.

권장 JSONL import shape:

```jsonc
{
  "soundAssetId": 123,
  "llmSource": "gemini-audio-classify",
  "runName": "cinematic_all_batch_20260418",
  "primaryClass": "Foley",
  "secondClass": "Object_handling",
  "classConfidence": 0.82,
  "shortCaptionEn": "A cardboard box is dragged across a rough floor.",
  "longCaptionEn": "A dry scraping sound from a cardboard box moving over a textured surface...",
  "tagsStructured": {
    "material": ["cardboard"],
    "action": ["drag", "scrape"]
  },
  "rawResultJson": {},
  "embeddings": [
    {
      "embeddingTarget": "combined_caption",
      "embeddingText": "short: ...\nlong: ...",
      "embeddingModel": "gemini-embedding-001",
      "embeddingDim": 3072,
      "embedding": [0.001, -0.002]
    }
  ]
}
```

## 9. 백엔드 / AI 쪽 결정 필요 사항

실제 백엔드 마이그레이션 작성 전에 아래를 결정해야 한다.

1. B worker가 각 오디오를 분석할 때 `sound_assets.s3_key`를 받을 수 있는가?
2. 현재 `sound_assets.original_path`가 `Vector_search_test.audio_assets.relative_file_path`와 같은 라이브러리 상대 경로를 보존하고 있는가?
3. 운영 검색 범위를 처음부터 전체 major group으로 할 것인가, 아니면 `foley`, `sfx`부터 할 것인가?
4. canonical embedding model name string은 무엇인가? AI 코드가 쓰는 정확한 값을 백엔드와 맞춰야 한다.
5. `sound_assets.embedding`은 유지할 것인가, 아니면 `sound_asset_ai_embeddings` 추가 후 점진적으로 deprecated 처리할 것인가?
6. 운영에서도 `retrieval_results` 같은 검색 결과 저장 테이블이 필요한가, 아니면 초기에는 로그만 남길 것인가?

## 10. 1차 권장 결정안

우선 다음 계약으로 가는 것을 권장한다.

- `sound_assets`는 기준 오디오 자산 테이블로 유지한다.
- `sound_asset_ai_descriptions`를 추가한다.
- `sound_asset_ai_embeddings`를 추가한다.
- 로컬 AI row와 백엔드 row 매칭은 `s3_key` 우선, `original_path` 다음, `file_name` 마지막 순서로 한다.
- 백엔드 매칭은 `combined_caption` 임베딩을 사용한다.
- A worker의 프로젝트 분석 Redis 계약은 당장 변경하지 않는다.

