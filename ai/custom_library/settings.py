from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5433/vector_search_test",
)
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "gemini-embedding-2-preview")
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "3072"))
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
ENABLE_LANGFUSE = os.getenv("ENABLE_LANGFUSE", "false").lower() == "true"
LANGFUSE_PUBLIC_KEY = os.getenv("LANGFUSE_PUBLIC_KEY", "")
LANGFUSE_SECRET_KEY = os.getenv("LANGFUSE_SECRET_KEY", "")
LANGFUSE_HOST = os.getenv("LANGFUSE_HOST", "http://localhost:3000")
DEBUG_EMBEDDING_RESPONSE = os.getenv("DEBUG_EMBEDDING_RESPONSE", "false").lower() == "true"
ENABLE_TOKEN_COUNT = os.getenv("ENABLE_TOKEN_COUNT", "true").lower() == "true"
ENABLE_LANGFUSE_FLUSH = os.getenv("ENABLE_LANGFUSE_FLUSH", "false").lower() == "true"
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET", "")
AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-2")
AWS_S3_PREFIXES = [
    prefix.strip()
    for prefix in os.getenv("AWS_S3_PREFIXES", "").split(",")
    if prefix.strip()
]

AUDIO_JSON_ROOT = Path(
    r"C:\Users\SSAFY\Desktop\FINAL_PJT\final_pjt\S14P31F104\ai\gemini-audio-classify\result"
)
