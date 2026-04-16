"""AI Worker — Redis에서 JobRequest 를 polling 하여 파이프라인 실행.

계약: ai/redis_contract.md
- 진행 상황은 `job:progress:{jobId}` SET
- 완료 시 `job:done` XADD (JobDoneMessage)
- 실패 시 progress=failed + message 만 남기고 job:done 은 발행하지 않음
- 키 삭제는 백엔드 책임 (AI 는 cleanup 안 함)
"""

import traceback

import redis_client as rc
import s3_client as s3
import pipeline
from config import POLL_INTERVAL
import time


def _process(req: rc.JobRequest) -> None:
    job_id = req.job_id
    project_id = req.project_id

    rc.set_progress(
        job_id, project_id,
        status="pending", progress=0, current_stage="preprocessing",
    )

    local_path = f"/tmp/{job_id}.mp4"
    s3.download(req.video_path, local_path)

    done_msg = pipeline.run(req, local_path)
    rc.publish_job_done(done_msg)
    print(f"[{job_id}] Completed, XADD job:done")


def main() -> None:
    print("AI Worker started. Polling Redis...")

    while True:
        for req in rc.scan_pending_jobs():
            job_id = req.job_id

            # 이미 처리 중(progress 존재)이면 skip
            if rc.get_connection().get(f"job:progress:{job_id}"):
                continue

            print(f"[{job_id}] Processing started")
            try:
                _process(req)
            except Exception as e:
                traceback.print_exc()
                try:
                    rc.set_progress(
                        job_id, req.project_id,
                        status="failed", progress=0,
                        current_stage="failed",
                        message=f"{type(e).__name__}: {e}",
                    )
                except Exception:
                    pass
                print(f"[{job_id}] Failed")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
