# 오디오 벡터 검색 PoC 문서

## 1. 목적

이 문서는 `ai/Vector_search_test`에서 진행 중인 오디오 벡터 검색 PoC의 현재 구조와 실행 방법을 정리한 협업 문서입니다.

현재 검증하려는 핵심 목표는 다음과 같습니다.

- LLM이 생성한 오디오 묘사 JSON을 읽는다.
- 각 오디오 묘사 결과를 실제 로컬 사운드 샘플 파일과 연결한다.
- `short_caption_en`, `long_caption_en`, `combined_caption`을 임베딩한다.
- 오디오 파일 메타데이터, 묘사 텍스트, 임베딩 벡터를 로컬 PostgreSQL + pgvector DB에 저장한다.
- 외부 LLM이 생성한 영상 분석 JSON을 읽는다.
- 영상 이벤트별 `description`을 query embedding으로 만든다.
- 영상 이벤트 description과 오디오 묘사 embedding을 비교해 적절한 사운드 샘플을 찾는다.
- Gradio UI에서 이벤트별 추천 사운드를 검수한다.

현재 PoC는 기존 `back` 서비스와 분리해서 진행합니다. 기존 백엔드 스키마가 오래되었고 추후 변경될 가능성이 높기 때문에, 우선 독립적인 로컬 DB와 스크립트로 검색 품질을 검증하는 것이 목적입니다.

## 2. 현재 범위

현재 포함된 범위:

- Foley 사운드 샘플
- Hard_SFX 사운드 샘플
- Hard_SFX는 PoC DB에서 `sfx` 그룹으로 저장
- 외부 영상 분석 JSON 중 `track`이 `foley` 또는 `sfx`인 이벤트
- `gemini-embedding-2-preview` 기반 텍스트 임베딩
- PostgreSQL + pgvector 로컬 저장
- Gradio 기반 수동 검수 UI

아직 제외된 범위:

- ambience, music, cinematic, dialogue_vo 검색
- 임베딩 Batch API 사용
- 실제 `back` 서비스 통합
- S3 기반 오디오 파일 저장/재생 연동
- provider usage metadata 기반 자동 비용 계산

## 3. 주요 경로

### PoC 작업 폴더

```text
S14P31F104/ai/Vector_search_test
```

현재 벡터 검색 PoC의 주요 구현 파일이 이 폴더에 있습니다.

### 오디오 LLM 결과 JSON

```text
S14P31F104/ai/gemini-audio-classify/result
```

이 폴더에는 오디오 파일별 LLM 묘사 결과가 들어 있습니다. 주로 `results.json`, `sync_results.json` 파일을 사용합니다.

주요 필드:

- `key`
- `result.filename`
- `result.primary_class`
- `result.second_class`
- `result.class_confidence`
- `result.short_caption_en`
- `result.long_caption_en`
- `result.tags_structured`

### 로컬 사운드 샘플 경로

```text
C:\Users\SSAFY\Desktop\sound_data_zip\sound_library
```

현재 사용하는 하위 폴더:

- `Foley`
- `Hard_SFX`

오디오 JSON의 `filename`과 이 폴더 안의 실제 파일명을 매칭해서 DB에 저장합니다.

### 외부 영상 분석 JSON

```text
S14P31F104/ai/RAG_test/gemini_LLM_output/0417_carrotmarket_LLM_text_result.json
```

이 파일은 외부 LLM이 생성한 영상 분석 결과입니다.

주요 top-level 필드:

- `videoSummary`
- `videoContext`
- `events`

각 event의 주요 필드:

- `track`
- `description`
- `categoryPath`
- `startTime`
- `endTime`
- `peakTime`
- `tags`
- `confidence`

현재 PoC에서는 `track`이 `foley` 또는 `sfx`인 이벤트만 저장합니다.

## 4. 폴더 및 파일 설명

### `Vector_search_test`

현재 PoC의 메인 작업 폴더입니다.

주요 파일:

- `docker-compose.yml`
  - pgvector가 포함된 PostgreSQL을 로컬에서 실행합니다.
  - 외부 포트는 `5433`입니다.

- `schema.sql`
  - PoC용 DB 테이블을 정의합니다.

- `settings.py`
  - 환경변수와 주요 경로를 관리합니다.

- `db.py`
  - PostgreSQL 연결 helper입니다.

- `embedding.py`
  - Gemini 임베딩 호출과 토큰 카운트 helper입니다.

- `load_audio_assets.py`
  - 오디오 LLM JSON 결과를 읽습니다.
  - 실제 로컬 오디오 파일과 매칭합니다.
  - `audio_assets`, `audio_descriptions`에 upsert합니다.

- `embed_audio_texts.py`
  - 오디오 묘사 텍스트를 임베딩합니다.
  - `audio_embeddings`에 벡터를 저장합니다.
  - 실행 요약을 `runs/` 폴더에 JSON으로 저장합니다.

- `load_video_events.py`
  - 외부 영상 분석 JSON을 읽습니다.
  - `foley`, `sfx` 이벤트만 필터링해 `video_query_events`에 저장합니다.

- `search_events.py`
  - 영상 이벤트 description을 임베딩합니다.
  - 오디오 embedding과 벡터 유사도 검색을 수행합니다.
  - top-10 후보를 `retrieval_results`에 저장합니다.

- `review_ui.py`
  - Gradio 검수 UI입니다.
  - 이벤트별 추천 사운드 후보를 확인하고 재생할 수 있습니다.

- `runs/`
  - 임베딩 실행 요약 JSON이 저장됩니다.

- `.audio_preview/`
  - Gradio UI에서 브라우저 재생용으로 변환한 WAV 파일이 저장됩니다.

### `gemini-audio-classify`

오디오 분석/묘사 결과가 생성되는 폴더입니다.

현재 PoC는 아래 경로의 결과물을 사용합니다.

```text
ai/gemini-audio-classify/result
```

### `RAG_test/gemini_LLM_output`

외부 영상 분석 JSON이 저장되는 폴더입니다.

현재 PoC는 아래 파일을 사용합니다.

```text
0417_carrotmarket_LLM_text_result.json
```

## 5. DB 스키마 요약

PoC는 로컬 PostgreSQL + pgvector를 사용합니다.

### `audio_assets`

실제 오디오 파일 1개당 1 row입니다.

저장 정보:

- `asset_key`
- `source_group`
  - `foley`
  - `sfx`
- `original_filename`
- `local_file_path`
- `relative_file_path`
- 폴더 메타데이터

### `audio_descriptions`

오디오 파일에 대한 LLM 묘사 결과를 저장합니다.

저장 정보:

- `short_caption_en`
- `long_caption_en`
- `tags_structured`
- `primary_class`
- `second_class`
- `class_confidence`
- 원본 JSON payload

현재 결정:

- `tags_structured`는 저장만 합니다.
- 첫 번째 버전에서는 임베딩에 포함하지 않습니다.
- 검색 후 rerank/토큰 overlap 용도로만 사용합니다.

### `audio_embeddings`

오디오 묘사 텍스트의 임베딩 벡터를 저장합니다.

현재 embedding target:

- `short_caption`
- `long_caption`
- `combined_caption`

벡터 컬럼:

```sql
vector(3072)
```

주의:

- 현재 pgvector 환경에서 3072차원 HNSW index를 만들 수 없습니다.
- 그래서 HNSW index는 생성하지 않습니다.
- PoC 규모에서는 sequential vector search로 먼저 검증합니다.

### `video_query_events`

외부 영상 분석 JSON의 이벤트를 저장합니다.

현재는 아래 조건에 해당하는 이벤트만 저장합니다.

```text
track in {"foley", "sfx"}
```

### `video_query_embeddings`

영상 이벤트 description의 query embedding을 저장합니다.

현재 embedding target:

- `description`

### `retrieval_results`

영상 이벤트별 오디오 추천 결과를 저장합니다.

저장 정보:

- `rank_order`
- `similarity`
- `category_match_score`
- `tag_match_score`
- `final_score`
- `scoring_version`

## 6. 환경 설정

작업 폴더로 이동합니다.

```powershell
cd C:\Users\SSAFY\Desktop\FINAL_PJT\final_pjt\S14P31F104\ai\Vector_search_test
```

패키지 설치:

```powershell
pip install -r requirements.txt
```

`.env.example`을 복사해 `.env`를 만듭니다.

대량 임베딩 실행 시 추천 설정:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/vector_search_test
EMBEDDING_MODEL=gemini-embedding-2-preview
EMBEDDING_DIM=3072
GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY

ENABLE_LANGFUSE=false
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_HOST=http://localhost:3000

DEBUG_EMBEDDING_RESPONSE=false
ENABLE_TOKEN_COUNT=false
ENABLE_LANGFUSE_FLUSH=false
```

소량 테스트 또는 비용/토큰 확인 시 추천 설정:

```env
ENABLE_TOKEN_COUNT=true
ENABLE_LANGFUSE=true
ENABLE_LANGFUSE_FLUSH=false
```

Langfuse는 선택 기능입니다. 전체 임베딩 실행 시에는 SDK 종료 지연이나 background thread 문제를 피하기 위해 비활성화하는 것을 권장합니다.

## 7. 로컬 DB 실행

PostgreSQL 실행:

```powershell
docker compose up -d
```

스키마 초기화:

```powershell
python init_db.py
```

스키마 변경 등으로 DB를 완전히 초기화해야 하는 경우:

```powershell
docker compose down -v
docker compose up -d
python init_db.py
```

주의:

- `docker compose down -v`는 로컬 DB 볼륨을 삭제합니다.
- PoC 데이터를 모두 지워도 되는 경우에만 사용하세요.

## 8. 실행 파이프라인

### 1단계. 오디오 파일 및 묘사 텍스트 적재

```powershell
python load_audio_assets.py
```

현재 데이터 기준 기대 출력:

```text
processed result files: 44
upserted description rows: 4174
missing local files: 0
```

### 2단계. 오디오 묘사 텍스트 임베딩

소량 테스트:

```powershell
python embed_audio_texts.py --limit 10
```

중간 규모 테스트:

```powershell
python embed_audio_texts.py --limit 100
```

전체 실행:

```powershell
python embed_audio_texts.py
```

각 오디오 description마다 3개의 임베딩을 생성합니다.

- `short_caption`
- `long_caption`
- `combined_caption`

전체 실행 시 기대 row 수:

```text
4174 descriptions * 3 = 12522 embedding rows
```

DB 확인:

```powershell
docker exec -it vector-search-postgres psql -U postgres -d vector_search_test -c "SELECT embedding_target, COUNT(*) FROM audio_embeddings GROUP BY embedding_target ORDER BY embedding_target;"
```

전체 실행 후 기대 결과:

```text
combined_caption | 4174
long_caption     | 4174
short_caption    | 4174
```

벡터 차원 확인:

```powershell
docker exec -it vector-search-postgres psql -U postgres -d vector_search_test -c "SELECT id, embedding_target, vector_dims(embedding), LEFT(embedding::text, 80) FROM audio_embeddings ORDER BY id LIMIT 10;"
```

정상이라면:

```text
vector_dims = 3072
```

### 3단계. 영상 이벤트 적재

```powershell
python load_video_events.py
```

이 스크립트는 외부 LLM JSON에서 `foley`, `sfx` 이벤트만 저장합니다.

DB 확인:

```powershell
docker exec -it vector-search-postgres psql -U postgres -d vector_search_test -c "SELECT track, COUNT(*) FROM video_query_events GROUP BY track ORDER BY track;"
```

### 4단계. 영상 이벤트별 오디오 검색

```powershell
python search_events.py
```

이 스크립트는 다음 일을 수행합니다.

- 각 영상 이벤트의 `description`을 query embedding으로 변환
- `track`으로 후보군 1차 필터
- `combined_caption` embedding과 벡터 유사도 비교
- category/tag/class 정보로 rerank
- top-10 결과를 `retrieval_results`에 저장

결과 확인:

```powershell
docker exec -it vector-search-postgres psql -U postgres -d vector_search_test -c "SELECT COUNT(*) FROM retrieval_results;"
```

### 5단계. Gradio UI 검수

```powershell
python review_ui.py
```

브라우저 접속:

```text
http://127.0.0.1:7861
```

UI에서 확인 가능한 것:

- 영상 이벤트 description
- 이벤트 track/category/tags
- 추천 사운드 후보 top-k
- 후보별 `final_score`, `similarity`, `category_score`, `tag_score`
- top1 오디오 재생
- 후보 테이블에서 특정 row 클릭 시 해당 후보 오디오 재생

오디오 재생 관련:

- 브라우저에서 원본 WAV를 바로 재생하지 못하는 경우가 있습니다.
- `review_ui.py`는 선택된 오디오를 `ffmpeg`로 브라우저 친화적인 WAV로 변환합니다.
- 변환 파일은 `.audio_preview/`에 저장됩니다.
- 소리가 안 들리면 `ffmpeg`가 PATH에 잡혀 있는지 확인해야 합니다.

## 9. 검색 로직

현재 검색 흐름:

1. 영상 이벤트를 읽는다.
2. `track`을 hard filter로 사용한다.
   - `foley` 이벤트는 `audio_assets.source_group = 'foley'`만 검색
   - `sfx` 이벤트는 `audio_assets.source_group = 'sfx'`만 검색
3. 이벤트 `description`을 query embedding으로 만든다.
4. 오디오의 `combined_caption` embedding과 벡터 유사도를 계산한다.
5. top 후보를 가져온다.
6. category/tag/class 기반 점수로 rerank한다.

현재 점수식:

```text
final_score =
  0.75 * vector_similarity
  + 0.10 * category_score
  + 0.10 * tag_score
  + 0.05 * class_confidence
```

이 점수식은 실험용입니다. Gradio UI에서 실제 결과를 보면서 조정해야 합니다.

## 10. 토큰 및 비용 추적

Gemini embedding 응답에는 현재 Langfuse가 자동 비용 계산에 사용할 만한 usage metadata가 없습니다.

따라서:

- output token은 추적하지 않습니다.
- embedding에서는 input token이 핵심 지표입니다.
- `count_tokens()`는 소량 샘플 실행 시에만 사용하는 것을 권장합니다.
- 전체 실행에서는 속도를 위해 `ENABLE_TOKEN_COUNT=false`를 권장합니다.

임베딩 실행 요약은 아래 폴더에 JSON으로 저장됩니다.

```text
Vector_search_test/runs
```

저장되는 정보:

- 선택된 오디오 description 수
- 저장된 embedding 수
- 총 입력 문자 수
- 총 입력 토큰 수
- target별 문자/토큰 수

100개 description 샘플 실행 예시:

```text
total input tokens: 7016
short_caption: 920
long_caption: 2390
combined_caption: 3706
```

전체 오디오 임베딩 토큰 규모 추정:

```text
4174 descriptions * 약 70 input tokens = 약 292k input tokens
```

정확한 비용은 실제 사용 시점의 Gemini 공식 가격표를 다시 확인해야 합니다.

## 11. Langfuse 관련 메모

Langfuse 연동은 되어 있지만 선택 기능입니다.

권장 사용 방식:

- 소량 테스트/디버깅 시에만 활성화
- 전체 임베딩 실행 시에는 비활성화

이유:

- Langfuse SDK가 종료 시 background task를 정리하면서 지연될 수 있습니다.
- self-host Langfuse 응답 상태에 따라 로컬 스크립트 종료가 늦어질 수 있습니다.
- Gemini embedding 응답에 비용 계산용 usage metadata가 없을 수 있습니다.

현재 스위치:

```env
ENABLE_LANGFUSE=false
ENABLE_LANGFUSE_FLUSH=false
```

Langfuse 활성화 시 기록되는 정보:

- input text
- task type
- input char count
- token count 사용 시 input token count
- embedding dimension summary

## 12. 알려진 이슈 및 해결책

### 3072차원 HNSW index 생성 실패

발생한 에러:

```text
column cannot have more than 2000 dimensions for hnsw index
```

현재 해결:

- HNSW index를 만들지 않습니다.
- PoC에서는 sequential vector search로 먼저 검증합니다.

추후 선택지:

- embedding 차원 축소
- IVFFlat index 검토
- 외부 vector DB 사용
- reduced embedding 별도 저장

### 전체 임베딩 실행이 오래 걸림

이유:

- 4174 descriptions * 3 targets = 12522 embedding calls
- token count를 켜면 추가 호출이 발생합니다.

권장 설정:

```env
ENABLE_TOKEN_COUNT=false
ENABLE_LANGFUSE=false
DEBUG_EMBEDDING_RESPONSE=false
```

`embed_audio_texts.py`는 50개 description마다 진행률을 출력합니다.

### 브라우저에서 오디오가 재생되지 않음

일부 원본 WAV는 브라우저에서 바로 재생되지 않을 수 있습니다.

현재 해결:

- `review_ui.py`에서 선택된 오디오를 `ffmpeg`로 16-bit 44.1kHz WAV로 변환합니다.
- 변환 파일은 `.audio_preview/`에 캐시됩니다.

필요 조건:

- `ffmpeg`가 PATH에 등록되어 있어야 합니다.

## 13. Back 통합 시 고려사항

현재 PoC는 `back`과 독립적으로 동작합니다.

추후 통합 시 고려할 점은 다음과 같습니다.

### 스키마 통합

PoC 테이블과 백엔드 개념 매핑 예시:

- `audio_assets` -> 사운드 에셋 테이블
- `audio_descriptions` -> AI 생성 메타데이터 테이블
- `audio_embeddings` -> 벡터 인덱스 테이블
- `video_query_events` -> AI 이벤트 테이블
- `retrieval_results` -> 추천/매칭 결과 테이블

기존 백엔드 스키마가 오래되었을 수 있으므로, PoC 스키마를 그대로 합치기보다는 필요한 개념을 재정의하는 것이 안전합니다.

### 오디오 저장 위치

현재 PoC는 로컬 파일 경로를 사용합니다.

```text
C:\Users\SSAFY\Desktop\sound_data_zip\sound_library
```

실서비스 또는 백엔드 통합 시에는 다음 정보가 필요합니다.

- S3 bucket
- S3 key
- signed URL
- streaming endpoint
- 개발용 local path fallback

### 임베딩 생성 시점

결정이 필요한 부분:

- 오디오 업로드 시 바로 임베딩할 것인지
- 배치 작업으로 임베딩할 것인지
- 모델 버전 변경 시 재임베딩할 것인지
- 과거 embedding을 보관할 것인지

### 모델 버전 관리

반드시 저장해야 할 정보:

- embedding model name
- embedding dimensionality
- embedding target
- generated timestamp

현재 모델:

```text
gemini-embedding-2-preview
```

### 백엔드 검색 API 흐름

추후 백엔드 API는 대략 다음 흐름을 가질 수 있습니다.

1. 영상 event description 또는 event JSON 수신
2. query embedding 생성
3. track/category 기반 필터링
4. vector search
5. rerank
6. top-k 사운드 후보 반환
7. 재생 가능한 URL 반환

### 성능

운영 환경에서는 다음을 고려해야 합니다.

- embedding batch API 사용 가능성
- vector index 전략
- query embedding cache
- rerank 후보 수 제한
- 모델 버전별 embedding 관리

## 14. 논의가 필요한 부분

### `tags_structured`를 임베딩에 넣을 것인가?

현재 결정:

- 저장은 한다.
- 첫 버전에서는 임베딩하지 않는다.
- rerank 또는 token overlap에만 사용한다.

추후 실험:

- `combined_with_tags` embedding target 추가
- `combined_caption`과 검색 품질 비교

### 어떤 caption target이 가장 좋은가?

현재 검색은 `combined_caption`을 사용합니다.

비교가 필요한 후보:

- `short_caption`
- `long_caption`
- `combined_caption`
- 세 embedding의 ensemble

### `categoryPath`를 hard filter로 쓸 것인가?

현재 결정:

- `track`은 hard filter
- `categoryPath`는 reranking signal

이유:

- 외부 LLM의 category가 틀릴 수 있습니다.
- 영상 event taxonomy와 오디오 taxonomy가 완전히 일치하지 않을 수 있습니다.

실제 검색 결과를 보면서 조정해야 합니다.

### Foley/SFX 외 트랙은 어떻게 처리할 것인가?

현재 결정:

- `load_video_events.py`에서 저장하지 않습니다.

추후 확장:

- ambience index
- music index
- cinematic index
- dialogue/VO index
- 트랙별 별도 scoring rule

### 검색 품질 평가는 어떻게 할 것인가?

필요한 절차:

- Gradio UI에서 top-k 수동 검수
- 좋은 매칭/나쁜 매칭 표시
- feedback export
- score weight 조정
- 반복 평가

## 15. 추천 다음 단계

1. 전체 오디오 embedding row count 확인
2. `load_video_events.py` 실행
3. `search_events.py` 실행
4. `review_ui.py`로 top-k 결과 수동 확인
5. 실패 패턴 정리
6. score weight 조정
7. 영어 자연어 직접 검색 스크립트 추가
8. `tags_structured` embedding 실험 여부 결정
9. PoC 품질이 괜찮으면 `back` 통합 설계 진행
## Cinematic 그룹 반영 메모

2026-04-21 기준으로 PoC 검색 대상에 `cinematic` 그룹을 추가했습니다.

변경된 동작:

- `load_video_events.py`는 이제 `foley`, `sfx`, `cinematic` 이벤트를 저장합니다.
- `search_events.py`는 `track = cinematic` 이벤트를 `audio_assets.source_group = cinematic` 후보군에서 검색합니다.
- `review_ui.py`는 `cinematic` 후보의 로컬 미리보기 재생을 위해 `sound_library/Cinematic` 폴더를 fallback 검색합니다.
- `custom_library`의 스키마와 `infer_source_group()`은 이미 `cinematic`을 허용합니다.

주의할 점:

- Cinematic 오디오 결과 JSON이 `ai/gemini-audio-classify/result`에 있어야 합니다.
- S3 기준 적재를 사용할 경우 `.env`의 `AWS_S3_PREFIXES`에 Cinematic 경로가 포함되어야 합니다.
- Cinematic asset과 description을 새로 적재한 뒤에는 `embed_audio_texts.py`를 다시 실행해야 합니다.
- 기존 영상 이벤트/검색 결과에는 cinematic 이벤트가 빠져 있을 수 있으므로 `load_video_events.py`, `search_events.py`를 다시 실행해야 합니다.

권장 재실행 순서:

```powershell
python ..\custom_library\load_audio_assets.py
python ..\custom_library\embed_audio_texts.py
python load_video_events.py
python search_events.py
python review_ui.py
```
