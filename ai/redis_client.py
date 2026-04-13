import json
import redis

from config import REDIS_HOST, REDIS_PORT

JOB_REQUEST_PREFIX = "job:request:"
JOB_PROGRESS_PREFIX = "job:progress:"

_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)


def get_connection() -> redis.Redis:
    """Redis 연결 객체 반환."""
    return _client


def scan_pending_jobs() -> list[dict]:
    """대기 중인 job 목록 조회."""
    jobs = []
    for key in _client.scan_iter(f"{JOB_REQUEST_PREFIX}*"):
        raw = _client.get(key)
        if raw:
            jobs.append(json.loads(raw))
    return jobs


def get_job_request(job_id: str) -> dict | None:
    """특정 job 요청 조회."""
    raw = _client.get(f"{JOB_REQUEST_PREFIX}{job_id}")
    if not raw:
        return None
    return json.loads(raw)


def set_progress(job_id: str, status: str, progress: int) -> None:
    """job 진행 상태 업데이트."""
    data = {"job_id": job_id, "status": status, "progress": progress}
    _client.set(f"{JOB_PROGRESS_PREFIX}{job_id}", json.dumps(data))


def cleanup(job_id: str) -> None:
    """완료된 job 데이터 정리."""
    _client.delete(f"{JOB_REQUEST_PREFIX}{job_id}")
    _client.delete(f"{JOB_PROGRESS_PREFIX}{job_id}")
