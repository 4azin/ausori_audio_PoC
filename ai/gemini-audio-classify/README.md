# Gemini Audio Classify

`gemini-audio-classify`는 로컬 사운드 라이브러리를 대상으로 Gemini API를 이용해 오디오 메타데이터를 생성하는 작업용 도구입니다.

이 프로젝트는 두 가지 실행 방식을 지원합니다.

- `Batch` 방식: 비용 절감, 대량 처리, 결과가 늦게 옴
- `즉시 호출(sync)` 방식: 비용은 더 들 수 있지만 결과를 바로 볼 수 있음

## 기본 데이터 경로

`.env`에서 아래 경로를 설정합니다.

- `FOLEY_ROOT=C:\Users\SSAFY\Desktop\sound_data_zip\sound_library\Foley`
- `HARD_SFX_ROOT=C:\Users\SSAFY\Desktop\sound_data_zip\sound_library\Hard_SFX`

## 주요 폴더 구조

```text
ai/gemini-audio-classify/
  .env.example
  config.py
  main.py
  schema.py
  llmops.py
  result/
    foley_30/
      manifest.json
      manifest.csv
      uploads.json
      batch_requests.jsonl
      batch_job.json
      batch_output.jsonl
      results.json
      errors.json
```

## 설치

```powershell
cd C:\Users\SSAFY\Desktop\FINAL_PJT\final_pjt\S14P31F104\ai\gemini-audio-classify
pip install -r requirements.txt
```

`.env`에 최소한 아래 값들은 넣어야 합니다.

```env
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.1-flash-lite-preview
FOLEY_ROOT=C:\Users\SSAFY\Desktop\sound_data_zip\sound_library\Foley
HARD_SFX_ROOT=C:\Users\SSAFY\Desktop\sound_data_zip\sound_library\Hard_SFX
RUNS_DIR=C:\Users\SSAFY\Desktop\FINAL_PJT\final_pjt\S14P31F104\ai\gemini-audio-classify\result
```

Langfuse를 같이 쓰려면:

```env
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=http://localhost:3000
```

## 30건 테스트 예시

### 1. Foley에서 30건 샘플링

```powershell
python main.py sample --group foley --count 30 --run-name foley_30
```

생성 파일:

- `result/foley_30/manifest.json`
- `result/foley_30/manifest.csv`

### 2. Batch 방식으로 처리

```powershell
python main.py upload --run-name foley_30
python main.py build-batch --run-name foley_30
python main.py create-batch --run-name foley_30
python main.py wait-batch --run-name foley_30 --fetch-output --parse-output
```

### 3. 즉시 분석 방식으로 처리

한 건만:

```powershell
python main.py sync-analyze --run-name foley_30 --key foley-001
```

샘플 전체:

```powershell
python main.py sync-run --run-name foley_30
```

일부만:

```powershell
python main.py sync-run --run-name foley_30 --limit 5
```

## 100건 즉시 분석

Foley에서 100건을 바로 즉시 분석하려면:

```powershell
python main.py sample --group foley --count 100 --run-name foley_100_sync
python main.py sync-run --run-name foley_100_sync
```

Hard_SFX에서 100건을 바로 즉시 분석하려면:

```powershell
python main.py sample --group hard_sfx --count 100 --run-name hard_sfx_100_sync
python main.py sync-run --run-name hard_sfx_100_sync
```

즉시 분석 결과는 각 파일별로 저장됩니다.

현재는 run 단위 통합 파일로 저장됩니다.

- `result/foley_100_sync/sync_results.json`
- `result/foley_100_sync/sync_errors.json`

예전에 생성된 개별 `sync_result_*.json` 파일이 있다면 아래 명령으로 통합할 수 있습니다.

```powershell
python main.py merge-sync-results --run-name foley_100_sync --delete-individual
```

## Foley 전체를 100개씩 즉시 분석

Foley 전체를 100개 chunk로 나누고, 즉시 분석으로 순차 처리하려면:

```powershell
python main.py prepare-run --group foley --run-name foley_all_sync
python main.py split-run --run-name foley_all_sync --chunk-size 100
python main.py process-split-sync --run-name foley_all_sync --continue-on-error
```

이 명령은 child run들을 순서대로 처리합니다.

- `foley_all_sync_chunk_0001`
- `foley_all_sync_chunk_0002`
- ...

각 chunk마다 통합 결과가 생성됩니다.

- `result/foley_all_sync_chunk_0001/sync_results.json`
- `result/foley_all_sync_chunk_0002/sync_results.json`

### 특정 chunk 하나만 즉시 분석

```powershell
python main.py process-run-sync --run-name foley_all_sync_chunk_0001
```

### 중간에 멈췄다가 다시 이어서 실행

`process-run-sync`, `process-split-sync`는 이미 `sync_results.json`과 `sync_errors.json`이 있으면 그 chunk를 다시 돌리지 않고 건너뜁니다.

즉 아래 명령을 다시 실행하면 이미 끝난 chunk는 스킵되고, 남은 chunk만 이어서 처리합니다.

```powershell
python main.py process-split-sync --run-name foley_all_sync --continue-on-error
```

## 전체 라이브러리 처리

### 1. 전체 manifest 생성

```powershell
python main.py prepare-run --group all --run-name all_4500
```

이 명령은 `FOLEY_ROOT`와 `HARD_SFX_ROOT`를 모두 스캔해서 하나의 manifest를 만듭니다.

### 2. chunk 분할

```powershell
python main.py split-run --run-name all_4500 --chunk-size 200
```

예를 들어 아래처럼 child run이 생깁니다.

- `all_4500_chunk_0001`
- `all_4500_chunk_0002`
- `all_4500_chunk_0003`

그리고 부모 run에는 다음 파일이 생깁니다.

- `result/all_4500/split_runs.json`

### 3. 전체 chunk를 resume-safe하게 Batch 처리

```powershell
python main.py process-split --run-name all_4500 --cleanup-files --continue-on-error
```

## resume-safe 동작

`process-run`, `process-split`은 중간에 멈췄다가 다시 실행해도 가능한 한 이어서 가도록 만들었습니다.

현재 동작:

- `upload`: `uploads.json`이 있으면 이미 업로드한 파일은 건너뜀
- `create-batch`: `batch_job.json`이 있으면 기존 Batch job 재사용
- `fetch-output`: `batch_output.jsonl`이 이미 있으면 다시 받지 않음
- `parse-output`: `results.json`, `errors.json`이 있으면 다시 파싱하지 않음

즉 같은 명령을 다시 실행해도 처음부터 전부 다시 하지 않고, 이미 끝난 단계는 최대한 재사용합니다.

## 자주 쓰는 명령 정리

### Batch

```powershell
python main.py sample --group foley --count 30 --run-name foley_30
python main.py upload --run-name foley_30
python main.py build-batch --run-name foley_30
python main.py create-batch --run-name foley_30
python main.py wait-batch --run-name foley_30 --fetch-output --parse-output
```

### 즉시 분석

```powershell
python main.py sample --group foley --count 100 --run-name foley_100_sync
python main.py sync-run --run-name foley_100_sync
```

### 전체 라이브러리 Batch

```powershell
python main.py prepare-run --group all --run-name all_4500
python main.py split-run --run-name all_4500 --chunk-size 200
python main.py process-split --run-name all_4500 --cleanup-files --continue-on-error
```
