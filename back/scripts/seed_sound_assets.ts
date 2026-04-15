/**
 * seed_sound_assets.ts — sound_assets_*.jsonl → PostgreSQL 적재
 *
 * 전략:
 *   1) staging 테이블(UNLOGGED)로 COPY 스트리밍
 *   2) 카테고리 정합성 검증 (JSONL의 major/mid/sub_id/key vs 시드된 category_* 테이블)
 *   3) INSERT ... SELECT ... ON CONFLICT (s3_key) DO NOTHING 로 본 테이블 반영
 *
 * 전제: 001_init.sql, 002_seed_categories.sql 선행 적용.
 *
 * 실행:
 *   npx ts-node back/scripts/seed_sound_assets.ts [glob...]
 *   (default glob: ../sound_assets_*.jsonl — 리포 루트 기준)
 *
 * 재실행 멱등성: s3_key UNIQUE 기반 DO NOTHING. 완전 초기화가 필요하면
 *   TRUNCATE sound_assets RESTART IDENTITY CASCADE; 후 재실행.
 */

import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import * as path from 'node:path';
import { Client } from 'pg';
// pg-copy-streams 는 dev dep 추가 필요: npm i -D pg-copy-streams @types/pg-copy-streams
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { from: copyFrom } = require('pg-copy-streams');

// ------------------------------------------------------------
// JSONL row 타입
// ------------------------------------------------------------
interface JsonlRow {
  designer_id: number | null;
  file_name: string;
  s3_key: string;
  original_path: string | null;
  major_key: string;
  major_id: number;
  mid_key: string;
  mid_id: number;
  sub_key: string;
  sub_id: number;
  mood: string[];
  tags: string[];
  description: string | null;
  bpm: number | null;
  instruments: string[] | null;
  duration: number;
  format: 'mp3' | 'ogg' | 'wav';
  channels: 1 | 2;
  sample_rate: number;
  file_size: number;
  download_count: number;
  embedding: number[];
}

// ------------------------------------------------------------
// Helpers — PG COPY TEXT 형식 직렬화
// ------------------------------------------------------------
const NL = '\n';
const TAB = '\t';

/** COPY TEXT 포맷에서 특수문자 이스케이프 */
function esc(v: string): string {
  return v
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/** text[] → PG array literal {"a","b"} */
function pgTextArray(arr: string[] | null | undefined): string {
  if (!arr || arr.length === 0) return '{}';
  const inner = arr.map((s) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',');
  return `{${inner}}`;
}

/** vector(3072) → pgvector 텍스트 포맷 [v1,v2,...] */
function pgVector(vec: number[]): string {
  return '[' + vec.join(',') + ']';
}

function nullable<T>(v: T | null | undefined, render: (x: T) => string): string {
  return v === null || v === undefined ? '\\N' : render(v);
}

// ------------------------------------------------------------
// staging DDL — 본 테이블과 컬럼 동일, 제약 없음 (빠른 COPY)
// ------------------------------------------------------------
const STAGING_DDL = `
  CREATE UNLOGGED TABLE IF NOT EXISTS _staging_sound_assets (
    designer_id     BIGINT,
    file_name       VARCHAR(255) NOT NULL,
    s3_key          VARCHAR(500) NOT NULL,
    original_path   VARCHAR(500),
    major_id        BIGINT NOT NULL,
    mid_id          BIGINT NOT NULL,
    sub_id          BIGINT NOT NULL,
    major_key       TEXT NOT NULL,
    mid_key         TEXT NOT NULL,
    sub_key         TEXT NOT NULL,
    mood            TEXT[] NOT NULL DEFAULT '{}',
    tags            TEXT[] NOT NULL DEFAULT '{}',
    description     TEXT,
    bpm             INT,
    instruments     TEXT[],
    duration        REAL NOT NULL,
    format          TEXT NOT NULL,
    channels        INT NOT NULL,
    sample_rate     INT NOT NULL,
    file_size       INT NOT NULL,
    download_count  INT NOT NULL,
    embedding       vector(3072)
  );
`;

const COPY_SQL = `
  COPY _staging_sound_assets (
    designer_id, file_name, s3_key, original_path,
    major_id, mid_id, sub_id, major_key, mid_key, sub_key,
    mood, tags, description, bpm, instruments,
    duration, format, channels, sample_rate, file_size,
    download_count, embedding
  ) FROM STDIN WITH (FORMAT text)
`;

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
async function main() {
  const argGlobs = process.argv.slice(2);
  const files = argGlobs.length > 0
    ? argGlobs
    : await defaultJsonlFiles();

  if (files.length === 0) {
    console.error('no jsonl files found');
    process.exit(1);
  }
  console.log('[seed] files:', files);

  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME ?? 'postgres',
  });
  await client.connect();

  try {
    // 1) staging 생성 + 초기화
    await client.query('BEGIN');
    await client.query(STAGING_DDL);
    await client.query('TRUNCATE _staging_sound_assets');
    await client.query('COMMIT');

    // 2) 파일별 스트리밍 COPY
    let total = 0;
    for (const file of files) {
      const count = await copyFile(client, file);
      console.log(`[seed] ${path.basename(file)} — ${count} rows`);
      total += count;
    }
    console.log(`[seed] staged total: ${total}`);

    // 3) 정합성 검증 — JSONL의 key 와 시드된 category 이름 일치 확인
    //    sub는 flat 라벨이라 mid 종속 검증은 하지 않음 (mid만 major 종속 확인).
    const mismatch = await client.query(`
      SELECT s.s3_key, s.major_id, s.major_key, s.mid_id, s.mid_key, s.sub_id, s.sub_key
      FROM _staging_sound_assets s
      LEFT JOIN category_major ma ON ma.id = s.major_id
      LEFT JOIN category_mid   mi ON mi.id = s.mid_id
      LEFT JOIN category_sub   su ON su.id = s.sub_id
      WHERE ma.name IS DISTINCT FROM s.major_key
         OR mi.name IS DISTINCT FROM s.mid_key
         OR su.name IS DISTINCT FROM s.sub_key
         OR mi.major_id IS DISTINCT FROM s.major_id
      LIMIT 20
    `);
    if (mismatch.rowCount && mismatch.rowCount > 0) {
      console.error('[seed] FAIL — category mismatch (first 20):');
      console.error(mismatch.rows);
      throw new Error('category integrity check failed');
    }
    console.log('[seed] category integrity OK');

    // 4) 본 테이블 반영
    await client.query('BEGIN');
    const inserted = await client.query(`
      INSERT INTO sound_assets (
        designer_id, file_name, s3_key, original_path,
        major_id, mid_id, sub_id,
        mood, tags, description, bpm, instruments,
        duration, format, channels, sample_rate, file_size,
        download_count, embedding
      )
      SELECT
        designer_id, file_name, s3_key, original_path,
        major_id, mid_id, sub_id,
        mood, tags, description, bpm, instruments,
        duration, format::sound_format, channels, sample_rate, file_size,
        download_count, embedding
      FROM _staging_sound_assets
      ON CONFLICT (s3_key) DO NOTHING
    `);
    console.log(`[seed] inserted into sound_assets: ${inserted.rowCount}`);

    await client.query('DROP TABLE _staging_sound_assets');
    await client.query('COMMIT');

    // 5) 최종 카운트
    const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM sound_assets');
    console.log(`[seed] sound_assets total: ${rows[0].n}`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}

async function defaultJsonlFiles(): Promise<string[]> {
  // 리포 루트의 sound_assets_*.jsonl
  const root = path.resolve(__dirname, '../../');
  const entries = await readdir(root);
  return entries
    .filter((f) => /^sound_assets_\d+\.jsonl$/.test(f))
    .sort()
    .map((f) => path.join(root, f));
}

async function copyFile(client: Client, filePath: string): Promise<number> {
  const stream = (client as unknown as { query: (q: unknown) => NodeJS.WritableStream })
    .query(copyFrom(COPY_SQL));

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let n = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as JsonlRow;
    const tsv = [
      nullable(row.designer_id, String),
      esc(row.file_name),
      esc(row.s3_key),
      nullable(row.original_path, esc),
      String(row.major_id),
      String(row.mid_id),
      String(row.sub_id),
      esc(row.major_key),
      esc(row.mid_key),
      esc(row.sub_key),
      pgTextArray(row.mood),
      pgTextArray(row.tags),
      nullable(row.description, esc),
      nullable(row.bpm, String),
      row.instruments == null ? '\\N' : pgTextArray(row.instruments),
      String(row.duration),
      row.format,
      String(row.channels),
      String(row.sample_rate),
      String(row.file_size),
      String(row.download_count),
      pgVector(row.embedding),
    ].join(TAB) + NL;

    if (!stream.write(tsv)) {
      await new Promise<void>((resolve) => stream.once('drain', () => resolve()));
    }
    n++;
  }

  await new Promise<void>((resolve, reject) => {
    stream.end();
    stream.once('finish', () => resolve());
    stream.once('error', reject);
  });
  return n;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
