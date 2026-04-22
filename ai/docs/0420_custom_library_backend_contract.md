# Custom Library 백엔드 데이터 계약 문서

## 1. 목적

이 문서는 `ai/custom_library`가 담당하는 오디오 라이브러리 분석/인덱싱 결과를 백엔드 DB에 어떻게 전달하고 저장해야 하는지 정리한다.

`custom_library`의 책임은 아래 1~4단계다.

```text
1. S3 오디오 객체 목록 조회
2. gemini-audio-classify 결과 JSON 읽기
3. 오디오별 AI caption/tags 저장
4. 오디오 caption을 임베딩해서 저장
```

`Vector_search_test`는 이 데이터가 이미 준비되어 있다고 가정하고 영상 event 검색만 수행한다.

운영 목표:

- 백엔드의 `sound_assets`를 오디오 자산 canonical table로 유지한다.
- AI 오디오 메타데이터는 `sound_assets.id`에 연결한다.
- 운영 검색은 로컬 DB가 아니라 백엔드 DB의 AI caption/embedding을 사용한다.

## 2. 참고 파일

| 파일 | 참고 내용 |
| --- | --- |
| `ai/custom_library/load_audio_assets.py` | S3 객체와 AI 분석 JSON을 매칭하는 방식 |
| `ai/custom_library/s3_catalog.py` | S3 bucket/prefix에서 오디오 객체 목록을 읽는 방식 |
| `ai/custom_library/debug_s3_catalog.py` | S3 연결 및 prefix 진단 방식 |
| `ai/custom_library/embed_audio_texts.py` | caption별 embedding 생성 및 저장 방식 |
| `ai/custom_library/embedding.py` | Gemini document embedding 호출 방식 |
| `ai/custom_library/schema.sql` | PoC용 오디오 인덱싱 DB 구조 |
| `ai/gemini-audio-classify/result/**/results.json` | 실제 오디오 분석 결과 JSON |
| `back/db/migrations/001_init.sql` | 백엔드 `sound_assets`, category 기준 스키마 |

## 3. 입력 데이터

### 3-1. S3 오디오 객체

`custom_library`는 S3에서 오디오 객체 목록을 읽는다.

필요 env:

```env
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_REGION=ap-northeast-2
AWS_S3_PREFIXES=
```

S3 객체 예시:

```jsonc
{
  "bucket": "ausori",
  "key": "audio/foley/body/general/RS, Human, Fart_54.wav",
  "filename": "RS, Human, Fart_54.wav",
  "size": 123456
}
```

### 3-2. gemini-audio-classify 결과 JSON

`gemini-audio-classify` 결과 JSON의 한 row 예시:

```jsonc
{
  "key": "foley-00001",
  "result": {
    "primary_class": "Foley",
    "second_class": "body",
    "class_confidence": 0.9,
    "short_caption_en": "A short comic human body sound.",
    "long_caption_en": "A brief dry human body sound with a humorous texture.",
    "tags_structured": {
      "temporal": "one_shot",
      "realism": "realistic",
      "action": ["movement"],
      "texture": ["dry"]
    },
    "filename": "RS, Human, Fart_54.wav"
  },
  "usage_details": {
    "prompt_tokens": 1000,
    "completion_tokens": 120,
    "total_tokens": 1120
  }
}
```

현재 PoC에서는 `result.filename`과 S3 객체 filename을 매칭한다.

## 4. 백엔드 canonical 매칭 기준

운영에서는 filename 단독 매칭보다 백엔드 `sound_assets` 기준 매칭을 권장한다.

우선순위:

1. `sound_assets.s3_key`
2. `sound_assets.original_path`
3. `sound_assets.file_name`

`file_name`은 중복 가능성이 있으므로 마지막 fallback으로만 사용한다.

백엔드가 AI 쪽에 제공하면 좋은 카탈로그 형태:

```jsonc
[
  {
    "soundAssetId": 123,
    "s3Key": "audio/foley/body/general/RS, Human, Fart_54.wav",
    "originalPath": "Foley/Body/General/RS, Human, Fart_54.wav",
    "fileName": "RS, Human, Fart_54.wav",
    "categoryPath": ["Foley", "Body", "General"]
  }
]
```

## 5. 백엔드로 전달할 데이터 형식

권장 전달 단위는 “오디오 1개 + AI description 1개 + embeddings[]”다.

JSONL 한 줄 예시:

```jsonc
{
  "soundAssetId": 123,
  "s3Key": "audio/foley/body/general/RS, Human, Fart_54.wav",
  "llmSource": "gemini-audio-classify",
  "runName": "foley_batch_20260420",
  "primaryClass": "Foley",
  "secondClass": "body",
  "classConfidence": 0.9,
  "shortCaptionEn": "A short comic human body sound.",
  "longCaptionEn": "A brief dry human body sound with a humorous texture.",
  "tagsStructured": {
    "temporal": "one_shot",
    "realism": "realistic",
    "action": ["movement"],
    "texture": ["dry"]
  },
  "rawResultJson": {
    "key": "foley-00001",
    "result": {}
  },
  "embeddings": [
    {
      "embeddingTarget": "short_caption",
      "embeddingText": "A short comic human body sound.",
      "embeddingModel": "gemini-embedding-2-preview",
      "embeddingDim": 3072,
      "embedding": [0.001, -0.002]
    },
    {
      "embeddingTarget": "long_caption",
      "embeddingText": "A brief dry human body sound with a humorous texture.",
      "embeddingModel": "gemini-embedding-2-preview",
      "embeddingDim": 3072,
      "embedding": [0.001, -0.002]
    },
    {
      "embeddingTarget": "combined_caption",
      "embeddingText": "short: A short comic human body sound.\nlong: A brief dry human body sound with a humorous texture.",
      "embeddingModel": "gemini-embedding-2-preview",
      "embeddingDim": 3072,
      "embedding": [0.001, -0.002]
    }
  ]
}
```

필수 필드:

- `soundAssetId` 또는 `s3Key`
- `llmSource`
- `runName`
- `shortCaptionEn`
- `longCaptionEn`
- `rawResultJson`
- `embeddings[]`

운영 검색 필수 embedding:

- `combined_caption`

실험/비교용 embedding:

- `short_caption`
- `long_caption`

## 6. 백엔드 DB 구성 제안

기존 `sound_assets`에 AI 데이터를 직접 넣지 않고 별도 테이블로 분리한다.

### 6-1. `sound_asset_ai_descriptions`

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

### 6-2. `sound_asset_ai_embeddings`

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

### 6-3. 선택: `sound_assets` 상태 컬럼

오디오별 AI 메타데이터 준비 상태를 관리하고 싶다면 추가한다.

```sql
ALTER TABLE sound_assets
    ADD COLUMN ai_metadata_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (ai_metadata_status IN ('pending', 'ready', 'failed', 'stale'));

ALTER TABLE sound_assets
    ADD COLUMN ai_metadata_updated_at TIMESTAMPTZ;
```

## 7. PoC DB와 백엔드 DB 매핑

| `custom_library` PoC table | 백엔드 운영 table |
| --- | --- |
| `audio_assets` | `sound_assets` |
| `audio_descriptions` | `sound_asset_ai_descriptions` |
| `audio_embeddings` | `sound_asset_ai_embeddings` |

필드 매핑:

| PoC field | 백엔드 field |
| --- | --- |
| `audio_assets.s3_key` | `sound_assets.s3_key` 매칭용 |
| `audio_assets.original_filename` | `sound_assets.file_name` fallback |
| `audio_descriptions.primary_class` | `sound_asset_ai_descriptions.primary_class` |
| `audio_descriptions.second_class` | `sound_asset_ai_descriptions.second_class` |
| `audio_descriptions.class_confidence` | `sound_asset_ai_descriptions.class_confidence` |
| `audio_descriptions.short_caption_en` | `sound_asset_ai_descriptions.short_caption_en` |
| `audio_descriptions.long_caption_en` | `sound_asset_ai_descriptions.long_caption_en` |
| `audio_descriptions.tags_structured` | `sound_asset_ai_descriptions.tags_structured` |
| `audio_descriptions.raw_result_json` | `sound_asset_ai_descriptions.raw_result_json` |
| `audio_embeddings.embedding_target` | `sound_asset_ai_embeddings.embedding_target` |
| `audio_embeddings.embedding_text` | `sound_asset_ai_embeddings.embedding_text` |
| `audio_embeddings.embedding_model` | `sound_asset_ai_embeddings.embedding_model` |
| `audio_embeddings.embedding_dim` | `sound_asset_ai_embeddings.embedding_dim` |
| `audio_embeddings.embedding` | `sound_asset_ai_embeddings.embedding` |

## 8. 임베딩 규칙

참고 파일:

- `ai/custom_library/embed_audio_texts.py`
- `ai/custom_library/embedding.py`
- `ai/custom_library/utils.py`

오디오 caption embedding 규칙:

```text
task_type = RETRIEVAL_DOCUMENT
embedding_dim = 3072
```

embedding target:

```text
short_caption
long_caption
combined_caption
```

`combined_caption` 생성:

```text
short: {short_caption_en}
long: {long_caption_en}
```

백엔드 검색에서 기본으로 사용할 target:

```text
combined_caption
```

## 9. Import / Upsert 흐름

권장 백엔드 적재 흐름:

```text
1. 백엔드 `sound_assets` catalog export
2. custom_library/B worker 결과와 `sound_assets` 매칭
3. `sound_asset_ai_descriptions` upsert
4. `sound_asset_ai_embeddings` upsert
5. `sound_assets.ai_metadata_status = 'ready'` 갱신
6. 누락/중복/차원 검증 결과 로그 저장
```

upsert 기준:

```text
sound_asset_ai_descriptions:
  UNIQUE (sound_asset_id, llm_source, run_name)

sound_asset_ai_embeddings:
  UNIQUE (ai_description_id, embedding_target, embedding_model)
```

## 10. 검증 항목

백엔드 import 후 검증해야 할 항목:

- 모든 row가 유효한 `sound_asset_id`를 가진다.
- `embedding_dim = 3072`이다.
- 운영 검색 대상 row마다 `combined_caption` embedding이 있다.
- 동일 `sound_asset_id + llm_source + run_name`이 중복되지 않는다.
- S3 key 매칭 실패 row가 별도 로그로 남는다.
- `file_name` fallback 매칭은 중복 후보가 없는 경우에만 허용한다.

## 11. 현재 PoC 실행 결과

S3 기준으로 `custom_library` 계열 로직을 실행했을 때 확인된 결과:

```text
indexed s3 audio objects: 9044
processed result files: 44
upserted description rows: 4174
missing s3 objects: 0
```

즉 현재 AI 분석 결과 4174건은 S3 객체와 filename 기준으로 모두 매칭된 상태다.

운영 DB import에서는 filename 매칭보다 `s3_key` 또는 `sound_assets` catalog 기반 매칭으로 전환하는 것을 권장한다.

## 12. 백엔드와 AI가 맞춰야 할 사항

1. B worker가 분석 시점에 `sound_assets.s3_key` 또는 `soundAssetId`를 받을 수 있는지
2. `sound_assets.original_path`가 원본 라이브러리 상대 경로를 보존하는지
3. embedding model name을 무엇으로 고정할지
4. `short_caption`, `long_caption`, `combined_caption` 세 target을 모두 저장할지
5. AI 메타데이터 재생성 시 기존 run을 덮어쓸지, 새 `run_name`으로 append할지
6. `sound_assets.embedding` 기존 컬럼을 유지할지, 새 AI embedding 테이블로 대체할지

## 13. 1차 권장안

```text
custom_library / B worker:
  오디오 AI caption, tags, embeddings 생성

Backend:
  sound_assets catalog 기준으로 sound_asset_id 매칭
  sound_asset_ai_descriptions 저장
  sound_asset_ai_embeddings 저장

Vector Search / Backend matching:
  sound_asset_ai_embeddings.combined_caption을 검색 대상으로 사용
```

이렇게 분리하면 `custom_library`는 오디오 라이브러리 데이터 생산자, `Vector_search_test`는 검색 로직 reference로 역할이 명확해진다.

