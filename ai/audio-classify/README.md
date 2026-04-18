# Sound Sample Classification and Retrieval Pipeline

영상 분석 AI가 생성한 이벤트 JSON에 대해, 내부 사운드 라이브러리에서 가장 적합한 음향 에셋을 검색·반환하는 파이프라인입니다.

## 목차

- [개요](#개요)
- [시스템 아키텍처](#시스템-아키텍처)
- [디렉토리 구조](#디렉토리-구조)
- [설치](#설치)
- [환경 설정](#환경-설정)
- [사용법](#사용법)
- [핵심 설계 원칙](#핵심-설계-원칙)
- [스코어링 공식](#스코어링-공식)
- [데이터 모델](#데이터-모델)
- [파이프라인 상세](#파이프라인-상세)
- [평가 지표](#평가-지표)
- [테스트](#테스트)

---

## 개요

### 입력

영상 분석 AI(`pipeline.py`)가 생성한 이벤트 JSON

```json
{
  "event_id": "E1",
  "peak_time": 3000,
  "start_time": 2200,
  "end_time": 4500,
  "event_category": "foley",
  "event_tags": ["Material_Texture:Friction", "Cloth:Nylon"],
  "description": "The sound of repeatedly pressing the lever on a bicycle horn with a finger.",
  "confidence": 0.65
}
```

### 출력

1개의 best match + 2~3개의 alternatives + 점수 분석 + 매칭 근거

```json
{
  "event_id": "E1",
  "query_summary": {
    "event_category": "foley",
    "description": "The sound of repeatedly pressing the lever on a bicycle horn with a finger."
  },
  "best_match": {
    "asset_id": "sample3",
    "filename": "bicycle_horn_short_01.wav",
    "primary_class": "foley",
    "final_score": 0.91,
    "score_breakdown": {
      "class_score": 1.0,
      "tag_score": 0.42,
      "text_text_score": 0.95,
      "sparse_keyword_score": 0.71,
      "text_audio_score": 0.88
    },
    "match_reason": [
      "Direct semantic match for bicycle + horn",
      "Matches repeated lever-press behavior",
      "Audio embedding is consistent with a short mechanical horn sound"
    ]
  },
  "alternatives": [
    { "asset_id": "sample6", "final_score": 0.72 },
    { "asset_id": "sample1", "final_score": 0.68 }
  ]
}
```

---

## 시스템 아키텍처

```
┌──────────────────────────────────────────────────────────────────┐
│                     Phase A: Asset Indexing                      │
│                                                                  │
│  Audio File ─→ Preprocessing ─→ Gemma 4 (분류/캡션/태그)         │
│                                    │                             │
│                                    ▼                             │
│                         Gemini Embedding 2                       │
│                        ┌──────┬──────────┐                       │
│                        │ Text │  Audio   │                       │
│                        │ Emb  │  Emb     │                       │
│                        └──┬───┴────┬─────┘                       │
│                           ▼        ▼                             │
│                    ┌─────────────────────┐                       │
│                    │   SQLite Database   │                       │
│                    │  (5 tables, §15)    │                       │
│                    └─────────────────────┘                       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    Phase B: Event Retrieval                       │
│                                                                  │
│  Event JSON ─→ Query Normalization ─→ Tag Rewriting (Gemma 4)    │
│                       │                                          │
│                       ▼                                          │
│               Query Embedding (Gemini Embedding 2)               │
│                       │                                          │
│                       ▼                                          │
│  ┌─ Stage 1: Candidate Generation (Hybrid Scoring) ──────────┐  │
│  │  class_score + tag_score + text_text_score + sparse_score  │  │
│  │  → Top-K candidates (default: 50)                         │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          ▼                                       │
│  ┌─ Stage 2: Reranking (Text-to-Audio) ──────────────────────┐  │
│  │  query_text_emb × asset_audio_emb → text_audio_score      │  │
│  │  final = 0.65 × stage1 + 0.35 × text_audio               │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          ▼                                       │
│  ┌─ Stage 3: Diversity Cleanup ──────────────────────────────┐  │
│  │  duplicate cluster suppression → best + 2~3 alternatives  │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 디렉토리 구조

```
audio-classify/
├── config.py                 # 환경 설정, 모델 ID, 스코어링 가중치
├── models.py                 # Pydantic 데이터 모델 (Asset, Event, Result)
├── db.py                     # SQLite 데이터베이스 (5개 테이블)
├── caption_service.py        # Gemma 4: 분류 / 캡션 생성 / 태그 추출
├── embedding_service.py      # Gemini Embedding 2: 텍스트 + 오디오 임베딩
├── indexing_pipeline.py      # Phase A: 에셋 인덱싱 파이프라인
├── query_processor.py        # 쿼리 정규화 + 태그 재작성
├── scoring.py                # 5개 스코어 컴포넌트 계산
├── retrieval_pipeline.py     # Phase B: 3단계 하이브리드 검색
├── evaluation.py             # 평가 지표 (Recall@K, MRR, NDCG)
├── main.py                   # CLI 진입점
├── requirements.txt          # Python 의존성
├── .env.example              # 환경 변수 템플릿
├── sample_data/              # 테스트용 샘플 오디오 파일
└── tests/
    └── test_retrieval.py     # §13 Bicycle horn 통합 테스트
```

---

## 설치

```bash
# 1. conda 환경 활성화
conda activate audio-poc

# 2. 의존성 설치
pip install -r requirements.txt
```

### 필수 의존성

| 패키지 | 용도 |
|---|---|
| `google-genai` | Gemma 4 (분류/캡션) + Gemini Embedding 2 API |
| `pydantic` | 데이터 모델 검증 |
| `numpy` | 벡터 연산 (cosine similarity 등) |
| `mutagen` | 오디오 파일 메타데이터 추출 |
| `scikit-learn` | 평가 지표 보조 |
| `python-dotenv` | `.env` 파일 로딩 |

---

## 환경 설정

`.env.example`을 복사하여 `.env`를 생성하고 API 키를 설정합니다.

```bash
cp .env.example .env
```

```env
# Google API Key (필수)
GOOGLE_API_KEY=your-api-key-here

# 모델 설정
CAPTION_MODEL=gemma-4-multimodal          # §4.1 분류/캡션
EMBEDDING_MODEL=gemini-embedding-2-preview # §4.2 임베딩

# 임베딩 차원 (768 / 1536 / 3072)
EMBEDDING_DIM=768

# 데이터베이스 경로
DB_PATH=audio_classify.db

# 사운드 라이브러리 루트
SOUND_LIBRARY_ROOT=./sample_data

# 검색 후보 수
TOP_K_CANDIDATES=50
```

---

## 사용법

### 에셋 인덱싱

사운드 라이브러리의 오디오 파일을 인덱싱합니다.

```bash
# 오디오 파일이 있는 디렉토리 지정
python main.py index --audio-dir ./sample_data/

# 텍스트 기반 캡셔닝만 사용 (오디오 입력 없이 파일명 기반)
python main.py index --audio-dir ./sample_data/ --text-only
```

각 파일에 대해 다음이 수행됩니다:
1. 오디오 메타데이터 추출 (duration, sample_rate, channels)
2. Gemma 4로 분류, 캡션 생성, 구조화 태그 추출
3. Gemini Embedding 2로 텍스트 임베딩 생성
4. Gemini Embedding 2로 오디오 임베딩 생성
5. SQLite DB에 메타데이터 + 임베딩 저장

### 인덱싱 상태 확인

```bash
python main.py list
```

출력 예시:
```
ID                        Class        Conf  Caption
--------------------------------------------------------------------------------
bicycle_horn_short_01     foley         0.92  bicycle horn honk lever press
bicycle_gear_shifting_01  foley         0.88  bicycle gear shifting mechanical
frog_croaking_pond_01     sfx           0.95  frog croaking near pond
```

### 단일 이벤트 검색

```bash
python main.py retrieve --event '{
  "event_id": "E1",
  "event_category": "foley",
  "event_tags": ["Material_Texture:Friction", "Cloth:Nylon"],
  "description": "The sound of repeatedly pressing the lever on a bicycle horn with a finger.",
  "confidence": 0.65
}'
```

### 배치 검색

```bash
# events.json 파일에서 여러 이벤트 일괄 처리
python main.py batch --events events.json --out results.json
```

`events.json` 형식:

```json
[
  {
    "event_id": "E1",
    "event_category": "foley",
    "event_tags": ["Food_Drink:Chew"],
    "description": "생당근을 한입 베어 무는 순간 짧고 단단한 씹는 소리.",
    "confidence": 0.9
  },
  {
    "event_id": "E2",
    "event_category": "foley",
    "event_tags": ["Footsteps:Concrete"],
    "description": "콘크리트 계단을 빠르게 뛰어 내려오는 발소리.",
    "confidence": 0.9
  }
]
```

### 벤치마크 평가

```bash
python main.py evaluate --benchmark benchmark.json --out metrics.json
```

`benchmark.json` 형식:

```json
{
  "events": [
    {
      "event_id": "E1",
      "event_category": "foley",
      "description": "bicycle horn pressed repeatedly"
    }
  ],
  "ground_truth": {
    "E1": "sample3"
  }
}
```

---

## 핵심 설계 원칙

### 1. 텍스트로 검색하고, 오디오로 검증한다 (§2.1)

광범위한 후보를 텍스트 유사도로 먼저 생성한 뒤, 오디오 임베딩으로 순위를 보정합니다.

### 2. 카테고리를 초기 하드 필터로 사용하지 않는다 (§2.2, §12)

`foley`, `sfx`, `ambience` 등의 상위 카테고리는 **소프트 스코어링 신호**로만 사용합니다.

> **이유**: 실제 사운드 라이브러리에서 카테고리 경계는 모호하며, 업스트림 분류 오류 시 정답이 일찍 탈락할 수 있습니다.

### 3. 업스트림 태그를 맹목적으로 신뢰하지 않는다 (§8.1)

이벤트의 `event_tags`를 그대로 사용하지 않고, `description`에서 Gemma 4를 통해 태그를 **재작성**합니다.

```
입력 태그:   ["Material_Texture:Friction", "Cloth:Nylon"]  ← 잘못된 태그
설명:       "자전거 경적기 레버를 반복적으로 누르는 소리"
재작성 태그: object: [bicycle, horn, lever]
            action: [press, squeeze, repeat]
            material: [rubber, metal]                      ← 올바른 태그
```

### 4. 오디오 임베딩은 리랭커이지 유일한 판단 기준이 아니다 (§2.4)

오디오 임베딩은 긴 클립이나 혼합 소스에서 전체 장면을 대표할 수 있으므로, **리랭킹 전용** 신호로 사용합니다.

---

## 스코어링 공식

### Stage 1: 후보 생성 점수 (§10)

```
candidate_score_stage1 =
    0.15 × class_score          +     # 카테고리 소프트 매칭
    0.20 × tag_score             +     # 태그 오버랩
    0.50 × text_text_score       +     # 텍스트 임베딩 코사인 유사도 (주 신호)
    0.15 × sparse_keyword_score        # 키워드/파일명 매칭
```

### Final: 최종 점수 (§10)

```
final_score =
    0.65 × candidate_score_stage1 +    # Stage 1 점수
    0.35 × text_audio_score            # 텍스트→오디오 리랭킹
```

### 개별 스코어 컴포넌트

| 컴포넌트 | 계산 방법 | 역할 |
|---|---|---|
| `class_score` (§11.1) | 카테고리 소프트 매칭 (exact=1.0, adjacent=0.6, weak=0.2) | 분류 일치도 |
| `tag_score` (§11.2) | 0.35 × upstream_overlap + 0.65 × rewritten_overlap | 태그 유사도 |
| `text_text_score` (§11.3) | cosine(query_text_emb, asset_text_emb) | **주 검색 신호** |
| `sparse_keyword_score` (§11.4) | 파일명 + 별칭 + 캡션 trigram 매칭 | 키워드 일치 |
| `text_audio_score` (§11.5) | cosine(query_text_emb, asset_audio_emb) | 리랭킹 전용 |

---

## 데이터 모델

### 에셋 (§6)

| 필드 | 타입 | 설명 |
|---|---|---|
| `asset_id` | string | 고유 에셋 ID |
| `original_filename` | string | 원본 파일명 |
| `normalized_title` | string | 검색 정규화 이름 |
| `duration_ms` | int | 재생 시간 (ms) |
| `sample_rate` | int | 샘플레이트 |
| `channels` | int | 채널 수 |
| `storage_uri` | string | 오디오 파일 위치 |
| `primary_class` | string | 주 분류 |
| `class_confidence` | float | 분류 확신도 |
| `short_caption_en` | string | 짧은 영어 캡션 (검색용) |
| `long_caption_en` | string | 상세 영어 캡션 |
| `tags_structured` | json | 구조화 태그 |
| `text_embedding` | vector | 텍스트 임베딩 |
| `audio_embedding` | vector | 오디오 임베딩 |
| `embedding_model_version` | string | 임베딩 모델 버전 |
| `caption_model_version` | string | 캡션 모델 버전 |

### 구조화 태그 (§6)

```json
{
  "object": ["bicycle", "horn", "lever"],
  "action": ["press", "squeeze", "repeat"],
  "material": ["rubber", "metal"],
  "texture": ["short", "nasal", "mechanical"],
  "environment": ["close", "isolated", "dry"],
  "temporal": ["repetitive", "one_shot_cluster"],
  "editorial_role": ["foley"],
  "realism": "realistic"
}
```

### DB 스키마 (§15)

| 테이블 | 설명 |
|---|---|
| `audio_assets` | 에셋 메타데이터 |
| `audio_embeddings_text` | 텍스트 임베딩 벡터 |
| `audio_embeddings_audio` | 오디오 임베딩 벡터 |
| `audio_aliases` | 키워드 별칭 (sparse 매칭용) |
| `retrieval_logs` | 검색 요청 로그 |

---

## 파이프라인 상세

### Phase A: 에셋 인덱싱 (§7)

```
1. 오디오 파일 수집 (wav, mp3, flac, ogg, aac, m4a)
2. 전처리 및 유효성 검사
   - 30초 초과 → 경고 (세그멘테이션 권장)
   - 메타데이터 추출 (mutagen / ffprobe)
3. Gemma 4로 분류 / 캡션 / 태그 생성
4. 텍스트 정규화
5. Gemini Embedding 2로 텍스트 임베딩 생성
   - 입력: short_caption + long_caption + serialized_tags
   - 형식: "title: {title} | text: {content}"
6. Gemini Embedding 2로 오디오 임베딩 생성
   - 입력: 오디오 바이트 (raw audio bytes)
7. SQLite DB에 저장
8. 키워드 별칭 생성 (파일명 + 태그에서 추출)
```

### Phase B: 이벤트 검색 (§8–§9)

```
1. 쿼리 정규화 (§8)
   - description에서 태그 재작성 (Gemma 4)
   - 검색용 텍스트 생성
   - 쿼리 임베딩 생성 (Gemini Embedding 2)
     형식: "task: search result | query: {content}"

2. Stage 1: 후보 생성 (§9.1)
   - 전체 에셋에 대해 4개 스코어 계산
   - Stage 1 공식으로 점수 합산
   - Top-K (기본 50개) 후보 선정

3. Stage 2: 리랭킹 (§9.2)
   - Top-K 후보에 대해 text_audio_score 계산
   - 최종 점수 = 0.65 × stage1 + 0.35 × text_audio

4. Stage 3: 다양성 보정 (§9.3)
   - 텍스트 임베딩 cosine > 0.95인 중복 억제
   - best_match + 2~3개 alternatives 반환
```

---

## 평가 지표 (§17)

### 검색 지표

| 지표 | 설명 |
|---|---|
| Recall@1 | 정답이 1위에 있는 비율 |
| Recall@3 | 정답이 상위 3위 안에 있는 비율 |
| Recall@5 | 정답이 상위 5위 안에 있는 비율 |
| MRR | Mean Reciprocal Rank |
| NDCG | Normalized Discounted Cumulative Gain |

### 분류 지표

| 지표 | 설명 |
|---|---|
| Top-1 Accuracy | 분류 정확도 |
| Macro F1 | 클래스별 평균 F1 |
| Confusion Matrix | 분류 혼동 행렬 |

### 진단 항목

- 태그 불일치로 정답이 탈락한 비율
- 카테고리 불일치에도 정답이 검색된 비율
- 오디오 리랭킹이 순위를 개선한 비율
- 긴 클립 또는 혼합 소스 클립의 실패율

---

## 테스트

### §13 Bicycle Horn 통합 테스트

스펙 문서 §13에 정의된 레퍼런스 시나리오를 검증합니다.

```bash
conda activate audio-poc
$env:PYTHONIOENCODING="utf-8"   # Windows PowerShell
python tests/test_retrieval.py
```

**테스트 내용**:
- 8개 샘플 에셋 인덱싱 (mock 임베딩 사용)
- 자전거 경적 쿼리 실행
- upstream 태그가 `Material_Texture:Friction, Cloth:Nylon`으로 잘못 설정되어도
- `sample3` (bicycle horn)이 1위로 검색되는지 검증

**테스트 결과**:

```
Rank  ID            Final   Caption
1     sample3       0.422   bicycle horn honk lever press       ← 정답
2     sample1       0.252   bicycle gear shifting mechanical
3     sample6       0.244   bicycle chain clanking metallic
4     sample2       0.116   wheel moving through grass
5     sample7       0.107   quiet male breathing
6     sample4       0.062   frog croaking near pond
7     sample8       0.047   quiet rural ambience countryside
8     sample5       0.034   bright children crowd murmur

✅ PASSED — sample3이 1위
```

이 결과는 **업스트림 태그를 하드 필터로 사용하지 않는 것**이 왜 중요한지 증명합니다.

---

## 신뢰도 임계값 (§16.3)

| 점수 범위 | 판정 | 조치 |
|---|---|---|
| `≥ 0.80` | **강한 매칭** | 자동 적용 가능 |
| `0.65 ~ 0.80` | 사용 가능 매칭 | 자동 적용 가능 (주의) |
| `< 0.65` | **약한 매칭** | 리뷰 권장 표시 |

---

## 알려진 실패 사례와 대응 (§18)

| 실패 사례 | 대응 |
|---|---|
| 잘못된 업스트림 태그 | description에서 태그 재작성 + 소프트 시그널 처리 |
| 너무 길거나 혼합된 오디오 클립 | 세그멘테이션 + 구간별 임베딩 |
| 라이브러리/업스트림 분류 체계 불일치 | 카테고리 매핑 + 인접 카테고리 부스트 |
| 상위 결과가 모두 중복 | 다양성 리랭킹 + 중복 클러스터 억제 |
| 텍스트 매칭은 맞지만 오디오 리랭킹이 오히려 악화 | text_audio_score 가중치 축소 |

---

## 향후 계획

### Phase 2: 개선

- 태그 재작성 품질 향상
- 다양성 리랭킹 고도화
- 스코어 캘리브레이션
- 평가 데이터 기반 가중치 튜닝

### Phase 3: 프로덕션 최적화

- 임베딩 차원 최적화
- 대규모 인덱싱 최적화 (배치 API)
- 피드백 기반 리랭킹 개선
- PostgreSQL + pgvector 마이그레이션

---

## 모델 버전 관리 (§16.1)

임베딩과 캡션 모델 버전을 항상 저장하여, 나중에 모델 업그레이드 시 재인덱싱이 가능합니다.

저장되는 정보:
- 모델 이름 (`CAPTION_MODEL`, `EMBEDDING_MODEL`)
- 임베딩 차원 (`EMBEDDING_DIM`)
- 생성 타임스탬프 (`created_at`)

> **주의**: `gemini-embedding-001`과 `gemini-embedding-2-preview`의 임베딩 공간은 호환되지 않습니다.
> 모델을 변경하면 모든 에셋을 반드시 재인덱싱해야 합니다.
