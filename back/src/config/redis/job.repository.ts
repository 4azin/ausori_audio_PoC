import { redisClient } from "./client";
import { JobRequest, JobProgress } from "./types";

const JOB_REQUEST_PREFIX = "job:request:";
const JOB_PROGRESS_PREFIX = "job:progress:";

/** AI 작업 Redis 저장소 */
export const jobRepository = {

  /** 작업 요청 저장 */
  async enqueue(data: JobRequest): Promise<void> {
    await redisClient.set(
      `${JOB_REQUEST_PREFIX}${data.job_id}`,
      JSON.stringify(data)
    );
  },

  /** 작업 요청 조회 */
  async getRequest(jobId: string): Promise<JobRequest | null> {
    const raw = await redisClient.get(`${JOB_REQUEST_PREFIX}${jobId}`);

    if (!raw) return null;

    return JSON.parse(raw) as JobRequest;
  },

  /** 작업 진행 상황 저장 */
  async setProgress(data: JobProgress): Promise<void> {
    await redisClient.set(
      `${JOB_PROGRESS_PREFIX}${data.job_id}`,
      JSON.stringify(data)
    );
  },

  /** 작업 진행 상황 조회 */
  async getProgress(jobId: string): Promise<JobProgress | null> {
    const raw = await redisClient.get(`${JOB_PROGRESS_PREFIX}${jobId}`);

    if (!raw) return null;

    return JSON.parse(raw) as JobProgress;
  },

  /** 작업 데이터 삭제 (완료 후 정리) */
  async cleanup(jobId: string): Promise<void> {
    await redisClient.del(`${JOB_REQUEST_PREFIX}${jobId}`);
    await redisClient.del(`${JOB_PROGRESS_PREFIX}${jobId}`);
  },
};
