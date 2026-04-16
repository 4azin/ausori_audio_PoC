"""Redis I/O 계약 레이어 (redis_contract.md §2~§4).

- Wire 포맷: camelCase (pydantic `alias_generator=to_camel`)
- 시간 단위: 초(float)
- AI 는 SET(progress) / XADD(done) 만 한다. 키 수명은 백엔드가 관리.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import redis
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from config import REDIS_HOST, REDIS_PORT

JOB_REQUEST_PREFIX = "job:request:"
JOB_PROGRESS_PREFIX = "job:progress:"
JOB_DONE_STREAM = "job:done"

_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)


def get_connection() -> redis.Redis:
    return _client


# ---------------------------------------------------------------------------
# Pydantic 계약 모델
# ---------------------------------------------------------------------------

class _Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class VideoMeta(_Base):
    duration_seconds: float
    mime_type: str
    file_size: int


class JobRequest(_Base):
    job_id: str
    project_id: int
    user_id: int
    video_path: str
    video_meta: VideoMeta
    requested_at: str


class JobProgress(_Base):
    job_id: str
    project_id: int
    status: str
    progress: int
    current_stage: str | None = None
    message: str | None = None
    updated_at: str


class AiEvent(_Base):
    track: str
    description: str
    category_path: list[str]
    start_time: float
    end_time: float
    peak_time: float | None = None
    mood: list[str] = []
    energy: str | None = None
    texture: str | None = None
    tags: list[str] = []
    confidence: float


class JobDoneMessage(_Base):
    job_id: str
    project_id: int
    completed_at: str
    video_summary: str
    video_context: str
    events: list[AiEvent]
    telemetry: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# JobRequest (백엔드 → AI)
# ---------------------------------------------------------------------------

def scan_pending_jobs() -> list[JobRequest]:
    """대기 중인 job 요청들을 pydantic 모델로 반환."""
    jobs: list[JobRequest] = []
    for key in _client.scan_iter(f"{JOB_REQUEST_PREFIX}*"):
        raw = _client.get(key)
        if raw:
            jobs.append(JobRequest.model_validate_json(raw))
    return jobs


def get_job_request(job_id: str) -> JobRequest | None:
    raw = _client.get(f"{JOB_REQUEST_PREFIX}{job_id}")
    if not raw:
        return None
    return JobRequest.model_validate_json(raw)


# ---------------------------------------------------------------------------
# JobProgress (AI → 백엔드)
# ---------------------------------------------------------------------------

def set_progress(
    job_id: str,
    project_id: int,
    *,
    status: str,
    progress: int,
    current_stage: str | None = None,
    message: str | None = None,
) -> None:
    """`job:progress:{jobId}` 에 camelCase JSON SET."""
    payload = JobProgress(
        job_id=job_id,
        project_id=project_id,
        status=status,
        progress=progress,
        current_stage=current_stage,
        message=message,
        updated_at=datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
    )
    _client.set(
        f"{JOB_PROGRESS_PREFIX}{job_id}",
        payload.model_dump_json(by_alias=True),
    )


# ---------------------------------------------------------------------------
# JobDoneMessage (AI → 백엔드)
# ---------------------------------------------------------------------------

def publish_job_done(message: JobDoneMessage) -> str:
    """`job:done` 스트림에 1 entry XADD. 실패 시 예외 그대로 전파."""
    data = message.model_dump_json(by_alias=True)
    return _client.xadd(JOB_DONE_STREAM, {"data": data})
