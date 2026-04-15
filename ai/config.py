import os

from dotenv import load_dotenv

# config 는 프로젝트 어디서든 가장 먼저 import 되는 경우가 많으므로,
# analyzer/pipeline/worker 의 load_dotenv() 순서와 무관하게 .env 를 선반영.
load_dotenv()

# Redis
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

# S3
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-2")
AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET", "")

# Worker
POLL_INTERVAL = float(os.getenv("POLL_INTERVAL", "1.0"))

# ---------------------------------------------------------------------------
# Gemini 모델 (stage 별로 분리 관리)
#
# 기본값 우선순위:
#   1) stage 전용 env (GEMINI_MODEL_GLOBAL 등)
#   2) 공통 env (GEMINI_MODEL)
#   3) 코드 기본값
# ---------------------------------------------------------------------------

GEMINI_API_VIDEO = os.getenv("GEMINI_API_VIDEO", "")

_GEMINI_MODEL_DEFAULT = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

GEMINI_MODEL_GLOBAL = os.getenv("GEMINI_MODEL_GLOBAL", _GEMINI_MODEL_DEFAULT)
GEMINI_MODEL_GLOBAL_MUSIC = os.getenv("GEMINI_MODEL_GLOBAL_MUSIC", _GEMINI_MODEL_DEFAULT)
GEMINI_MODEL_FOLEY = os.getenv("GEMINI_MODEL_FOLEY", _GEMINI_MODEL_DEFAULT)
GEMINI_MODEL_NON_FOLEY = os.getenv("GEMINI_MODEL_NON_FOLEY", _GEMINI_MODEL_DEFAULT)
