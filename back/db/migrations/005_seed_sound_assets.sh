#!/bin/bash
# =============================================================
# 005_seed_sound_assets.sh
# docker-entrypoint-initdb.d 에서 자동 실행 (최초 볼륨 생성 시만)
# JSONL 파일을 PostgreSQL JSON 함수로 파싱하여 sound_assets 적재
# =============================================================

set -euo pipefail

DATA_DIR="/seed-data"

# JSONL 파일이 마운트됐는지 확인
shopt -s nullglob
FILES=("$DATA_DIR"/sound_assets_*.jsonl)
shopt -u nullglob

if [ ${#FILES[@]} -eq 0 ]; then
  echo "[seed] No JSONL files found in $DATA_DIR — skipping sound_assets seed."
  exit 0
fi

for f in "${FILES[@]}"; do
  echo "[seed] Loading $(basename "$f") ..."

  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- 1) raw JSONL 을 단일 컬럼 임시 테이블로 적재
    CREATE TEMP TABLE _raw_jsonl (line TEXT);
    \copy _raw_jsonl FROM '$f'

    -- 2) JSON 파싱 → sound_assets INSERT (중복 s3_key 무시)
    INSERT INTO sound_assets (
      designer_id, file_name, s3_key, original_path,
      major_id, mid_id, sub_id,
      mood, tags, description, bpm, instruments,
      duration, format, channels, sample_rate, file_size,
      download_count, embedding
    )
    SELECT
      (j->>'designer_id')::BIGINT,
      j->>'file_name',
      j->>'s3_key',
      j->>'original_path',
      (j->>'major_id')::BIGINT,
      (j->>'mid_id')::BIGINT,
      (j->>'sub_id')::BIGINT,
      ARRAY(SELECT jsonb_array_elements_text(j->'mood')),
      ARRAY(SELECT jsonb_array_elements_text(j->'tags')),
      j->>'description',
      (j->>'bpm')::INT,
      CASE WHEN j->'instruments' = 'null'::jsonb OR j->'instruments' IS NULL
           THEN NULL
           ELSE ARRAY(SELECT jsonb_array_elements_text(j->'instruments'))
      END,
      (j->>'duration')::REAL,
      (j->>'format')::sound_format,
      (j->>'channels')::INT,
      (j->>'sample_rate')::INT,
      (j->>'file_size')::INT,
      (j->>'download_count')::INT,
      (j->>'embedding')::vector(3072)
    FROM (
      SELECT line::jsonb AS j FROM _raw_jsonl WHERE line IS NOT NULL AND line <> ''
    ) parsed
    ON CONFLICT (s3_key) DO NOTHING;

    DROP TABLE _raw_jsonl;
EOSQL

  echo "[seed] $(basename "$f") done."
done

echo "[seed] sound_assets seed complete."
