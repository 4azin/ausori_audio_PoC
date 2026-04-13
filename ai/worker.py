"""AI Worker — Redis에서 job을 polling하여 파이프라인 실행."""

import time
import traceback

import redis_client as rc
import s3_client as s3
import pipeline
from config import POLL_INTERVAL


def main() -> None:
    print("AI Worker started. Polling Redis...")

    while True:
        jobs = rc.scan_pending_jobs()

        for job in jobs:
            job_id = job["job_id"]

            # 이미 처리 중인지 확인 (progress가 있으면 skip)
            progress = rc.get_connection().get(f"job:progress:{job_id}")
            if progress:
                continue

            print(f"[{job_id}] Processing started")
            rc.set_progress(job_id, "pending", 0)

            try:
                # S3에서 영상 다운로드
                local_path = f"/tmp/{job_id}.mp4"
                s3.download(job["video_path"], local_path)

                # 파이프라인 실행
                pipeline.run(job)

                print(f"[{job_id}] Completed")

            except Exception:
                traceback.print_exc()
                rc.set_progress(job_id, "failed", 0)
                print(f"[{job_id}] Failed")

            finally:
                rc.cleanup(job_id)

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
