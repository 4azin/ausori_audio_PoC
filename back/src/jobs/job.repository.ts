import { redisClient } from "../config/redis";
import { JobRequest, JobProgress, JobDoneMessage } from "./types";

const REQUEST_PREFIX = "job:request:";
const PROGRESS_PREFIX = "job:progress:";
const PROJECT_JOB_PREFIX = "project:job:";
export const JOB_DONE_STREAM = "job:done";
export const JOB_CONSUMER_GROUP = "backend";

/** AI 작업 Redis 저장소 — 진행률(SET/GET) + 완료 이벤트(Stream) 혼합 */
export const jobRepository = {
  /** 작업 요청 저장 */
  async enqueue(data: JobRequest): Promise<void> {
    await redisClient.set(`${REQUEST_PREFIX}${data.job_id}`, JSON.stringify(data));
  },

  async getRequest(jobId: string): Promise<JobRequest | null> {
    const raw = await redisClient.get(`${REQUEST_PREFIX}${jobId}`);
    return raw ? (JSON.parse(raw) as JobRequest) : null;
  },

  /** 진행 상황 갱신/조회 (AI 워커가 write, 백엔드가 read) */
  async setProgress(data: JobProgress): Promise<void> {
    await redisClient.set(`${PROGRESS_PREFIX}${data.job_id}`, JSON.stringify(data));
  },

  async getProgress(jobId: string): Promise<JobProgress | null> {
    const raw = await redisClient.get(`${PROGRESS_PREFIX}${jobId}`);
    return raw ? (JSON.parse(raw) as JobProgress) : null;
  },

  /** projectId ↔ jobId 매핑 (폴링 시 프로젝트로 진행률 찾기 위함) */
  async linkProjectJob(projectId: number, jobId: string): Promise<void> {
    await redisClient.set(`${PROJECT_JOB_PREFIX}${projectId}`, jobId);
  },

  async getJobIdForProject(projectId: number): Promise<string | null> {
    return redisClient.get(`${PROJECT_JOB_PREFIX}${projectId}`);
  },

  /** 완료/진행 데이터 정리 */
  async cleanup(jobId: string, projectId?: number): Promise<void> {
    await redisClient.del(`${REQUEST_PREFIX}${jobId}`);
    await redisClient.del(`${PROGRESS_PREFIX}${jobId}`);
    if (projectId !== undefined) {
      await redisClient.del(`${PROJECT_JOB_PREFIX}${projectId}`);
    }
  },

  /** 완료 이벤트 발행 (테스트/내부 호출용 — 실제로는 AI 워커가 XADD) */
  async publishDone(message: JobDoneMessage): Promise<string> {
    return redisClient.xAdd(JOB_DONE_STREAM, "*", { data: JSON.stringify(message) });
  },

  /** consumer group 생성 보장 (BUSYGROUP 무시) */
  async ensureConsumerGroup(): Promise<void> {
    try {
      await redisClient.xGroupCreate(JOB_DONE_STREAM, JOB_CONSUMER_GROUP, "0", {
        MKSTREAM: true,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("BUSYGROUP")) throw err;
    }
  },
};
