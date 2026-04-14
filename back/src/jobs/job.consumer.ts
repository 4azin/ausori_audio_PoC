import { redisClient } from "../config/redis";
import {
  projectModel,
  trackGroupModel,
  trackModel,
  trackEventModel,
} from "../models";
import {
  jobRepository,
  JOB_DONE_STREAM,
  JOB_CONSUMER_GROUP,
} from "./job.repository";
import { JobDoneMessage } from "./types";

const CONSUMER_NAME = `backend-${process.pid}`;
const BLOCK_MS = 5000;
const READ_COUNT = 10;

let running = false;
let subscriberClient: ReturnType<typeof redisClient.duplicate> | null = null;

/** AI 완료 결과를 DB에 반영 */
async function persistJobResult(payload: JobDoneMessage) {
  const { projectId, result } = payload;

  // 재시도에 안전하도록 기존 스냅샷 제거 후 재삽입
  await trackEventModel.deleteAllByProjectId(projectId);
  await trackModel.deleteAllByProjectId(projectId);
  await trackGroupModel.deleteAllByProjectId(projectId);

  const groups = await trackGroupModel.createMany(
    projectId,
    result.trackGroups.map((g) => ({
      type: g.type,
      volume: g.volume,
      isMuted: g.isMuted,
      isSolo: g.isSolo,
      order: g.order,
    })),
  );

  const tracks = await trackModel.createMany(
    projectId,
    result.tracks.map((t) => ({
      groupId: groups[t.groupIndex].id,
      name: t.name,
      volume: t.volume,
      pan: t.pan,
      isMuted: t.isMuted,
      order: t.order,
    })),
  );

  await trackEventModel.createMany(
    projectId,
    result.trackEvents.map((e) => ({
      trackId: tracks[e.trackIndex].id,
      soundAssetId: e.soundAssetId,
      startTime: e.startTime,
      endTime: e.endTime,
      offset: e.offset,
      volumeOverride: e.volumeOverride,
      fadeIn: e.fadeIn,
      fadeOut: e.fadeOut,
      isUserEdited: e.isUserEdited,
    })),
  );

  await projectModel.update(projectId, { status: "ready" });
  await jobRepository.cleanup(payload.jobId, projectId);
}

async function handleMessage(id: string, message: Record<string, string>) {
  const payload = JSON.parse(message.data) as JobDoneMessage;
  await persistJobResult(payload);
  if (subscriberClient) {
    await subscriberClient.xAck(JOB_DONE_STREAM, JOB_CONSUMER_GROUP, id);
  }
}

/** 백엔드 부팅 시 호출 — 별도 Redis 커넥션으로 스트림 구독 루프 시작 */
export async function startJobConsumer(): Promise<void> {
  if (running) return;
  running = true;

  await jobRepository.ensureConsumerGroup();

  subscriberClient = redisClient.duplicate();
  subscriberClient.on("error", (err) => {
    console.error("[jobs] subscriber redis error:", err);
  });
  await subscriberClient.connect();

  console.log(`[jobs] consumer started (${CONSUMER_NAME})`);

  (async function loop() {
    while (running && subscriberClient) {
      try {
        const res = (await subscriberClient.xReadGroup(
          JOB_CONSUMER_GROUP,
          CONSUMER_NAME,
          [{ key: JOB_DONE_STREAM, id: ">" }],
          { BLOCK: BLOCK_MS, COUNT: READ_COUNT },
        )) as Array<{
          name: string;
          messages: Array<{ id: string; message: Record<string, string> }>;
        }> | null;

        if (!res) continue;

        for (const stream of res) {
          for (const msg of stream.messages) {
            try {
              await handleMessage(msg.id, msg.message);
            } catch (err) {
              console.error("[jobs] handler failed for", msg.id, err);
            }
          }
        }
      } catch (err) {
        console.error("[jobs] consumer loop error:", err);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  })();
}

export async function stopJobConsumer(): Promise<void> {
  running = false;
  if (subscriberClient) {
    await subscriberClient.quit();
    subscriberClient = null;
  }
}
