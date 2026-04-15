# Langfuse Self-host (로컬 개발용)

AI 파이프라인 LLM observability 용. 로컬 도커로 단일 노드 구성.

## 1. 사전 준비

- Docker Desktop (WSL2 backend 권장)
- 포트 점유 확인: `3000`, `3030`, `9090`, `9091`
- 디스크 여유: clickhouse/postgres/minio 합해서 수 GB

## 2. 기동

```bash
cd ai/langfuse
cp .env.example .env

# 시크릿 교체 (Windows bash / git-bash 에서)
#   ENCRYPTION_KEY 는 반드시 64 hex chars
openssl rand -hex 32   # → .env 의 ENCRYPTION_KEY 로
openssl rand -hex 32   # → .env 의 NEXTAUTH_SECRET 으로
openssl rand -hex 16   # → .env 의 SALT 로

docker compose up -d
docker compose ps     # 모두 healthy 될 때까지 대기 (1~2분)
docker compose logs -f langfuse-web
```

## 3. 초기 설정
로컬에서 해보고 싶으시다면,

1. 브라우저 `http://localhost:3000` 접속.
2. 계정 생성(자기 자신이 최초 가입자 = admin).
3. Organization → Project 생성 (예: `s14p31f104-ai`).
4. 프로젝트 Settings → **API Keys → Create new API keys**.
5. 발급된 `public key (pk-lf-...)`, `secret key (sk-lf-...)` 를 `ai/.env` 에 추가:

```
LANGFUSE_PUBLIC_KEY=pk-lf-xxxxxxxx
LANGFUSE_SECRET_KEY=sk-lf-xxxxxxxx
LANGFUSE_HOST=http://localhost:3000
```

## 4. 접속 포트

| 서비스 | URL |
|---|---|
| Langfuse Web UI | http://localhost:3000 |
| Langfuse Worker health | http://localhost:3030/api/health |
| MinIO API | http://localhost:9090 |
| MinIO Console | http://localhost:9091 (user/pass: .env 의 MINIO_ROOT_*) |

## 5. 운영 커맨드

```bash
# 로그
docker compose logs -f langfuse-web
docker compose logs -f langfuse-worker

# 재기동
docker compose restart langfuse-web langfuse-worker

# 완전 초기화 (데이터 삭제됨 — 주의)
docker compose down -v
```

## 6. 주의

- 이 구성은 **로컬 개발 전용**. 프로덕션에서는
  - ENCRYPTION_KEY / SALT / 모든 패스워드 반드시 교체
  - TLS 종단(리버스 프록시) 필수
  - MinIO 대신 실제 S3, Postgres/Clickhouse 는 매니지드 사용 권장
- `.env` 는 커밋하지 말 것(.gitignore 에 `ai/langfuse/.env` 포함 확인).

다음 단계: `ai/llm_client.py` 에서 Langfuse SDK 로 trace/generation 기록 연동.
