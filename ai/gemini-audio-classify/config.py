from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:
    def load_dotenv(*_args, **_kwargs):
        return False


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite-preview")
LANGFUSE_PUBLIC_KEY = os.getenv("LANGFUSE_PUBLIC_KEY", "")
LANGFUSE_SECRET_KEY = os.getenv("LANGFUSE_SECRET_KEY", "")
LANGFUSE_BASE_URL = os.getenv("LANGFUSE_BASE_URL", "") or os.getenv("LANGFUSE_HOST", "")

FOLEY_ROOT = Path(
    os.getenv(
        "FOLEY_ROOT",
        r"C:\Users\SSAFY\Desktop\sound_data_zip\sound_library\Foley",
    )
)
HARD_SFX_ROOT = Path(
    os.getenv(
        "HARD_SFX_ROOT",
        r"C:\Users\SSAFY\Desktop\sound_data_zip\sound_library\Hard_SFX",
    )
)
CINEMATIC_ROOT = Path(os.getenv("CINEMATIC_ROOT", ""))
AMBIENCE_ROOT = Path(os.getenv("AMBIENCE_ROOT", ""))
MUSIC_ROOT = Path(os.getenv("MUSIC_ROOT", ""))
DIALOGUE_VO_ROOT = Path(os.getenv("DIALOGUE_VO_ROOT", ""))

RUNS_DIR = Path(os.getenv("RUNS_DIR", str(BASE_DIR / "runs")))

SUPPORTED_EXTENSIONS = {".wav"}


def ensure_runs_dir() -> Path:
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    return RUNS_DIR
