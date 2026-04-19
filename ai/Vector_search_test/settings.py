from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/vector_search_test",
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

AUDIO_JSON_ROOT = Path(
    r"C:\Users\SSAFY\Desktop\FINAL_PJT\final_pjt\S14P31F104\ai\gemini-audio-classify\result"
)
VIDEO_JSON_PATH = Path(
    r"C:\Users\SSAFY\Desktop\FINAL_PJT\final_pjt\S14P31F104\ai\RAG_test\gemini_LLM_output\0417_carrotmarket_LLM_text_result.json"
)
SOUND_LIBRARY_ROOT = Path(r"C:\Users\SSAFY\Desktop\sound_data_zip\sound_library")
