import { redisClient } from "../config/redis";
import { withTransaction } from "../config/db";
import {
  projectModel,
  trackGroupModel,
  trackModel,
  trackEventModel,
  aiEventModel,
  projectSnapshotModel,
  SnapshotPayload,
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

/** AI 완료 결과를 DB에 반영 — 트랜잭션으로 live replace + 스냅샷 생성 */
async function persistJobResult(payload: JobDoneMessage) {
  const { projectId, result } = payload;

  await withTransaction(async (client) => {
    // ai_events 는 append-only — track_events 는 지우더라도 여기는 유지
    const batch = await aiEventModel.nextBatch(projectId, client);
    const aiEvents = await aiEventModel.createMany(
      projectId,
      batch,
      result.aiEvents.map((a) => ({
        groupType: a.groupType,
        description: a.description,
        embedding: a.embedding,
        suggestedStartTime: a.suggestedStartTime ?? null,
        suggestedEndTime: a.suggestedEndTime ?? null,
      })),
      client,
    );

    await trackEventModel.deleteAllByProjectId(projectId, client);
    await trackModel.deleteAllByProjectId(projectId, client);
    await trackGroupModel.deleteAllByProjectId(projectId, client);

    const groups = await trackGroupModel.createMany(
      projectId,
      result.trackGroups.map((g) => ({
        type: g.type,
        volume: g.volume,
        isMuted: g.isMuted,
        isSolo: g.isSolo,
        order: g.order,
      })),
      client,
    );

    const tracks = await trackModel.createMany(
      projectId,
      result.tracks.map((t) => ({
        groupId: groups[t.groupIndex].id,
        name: t.name,
        volume: t.volume,
        pan: t.pan,
        isMuted: t.isMuted,
        isSolo: t.isSolo ?? false,
        order: t.order,
      })),
      client,
    );

    const events = await trackEventModel.createMany(
      projectId,
      result.trackEvents.map((e) => ({
        trackId: tracks[e.trackIndex].id,
        soundAssetId: e.soundAssetId,
        aiEventId: aiEvents[e.aiEventIndex]?.id ?? null,
        startTime: e.startTime,
        endTime: e.endTime,
        offset: e.offset,
        volumeOverride: e.volumeOverride,
        fadeIn: e.fadeIn,
        fadeOut: e.fadeOut,
        isUserEdited: e.isUserEdited,
      })),
      client,
    );

    const version = await projectSnapshotModel.nextVersion(projectId, client);

    const eventsByTrack = new Map<number, typeof events>();
    for (const e of events) {
      const arr = eventsByTrack.get(e.trackId) ?? [];
      arr.push(e);
      eventsByTrack.set(e.trackId, arr);
    }
    const tracksByGroup = new Map<number, typeof tracks>();
    for (const t of tracks) {
      const arr = tracksByGroup.get(t.groupId) ?? [];
      arr.push(t);
      tracksByGroup.set(t.groupId, arr);
    }

    const snapshotPayload: SnapshotPayload = {
      version,
      trackGroups: groups.map((g) => ({
        id: g.id,
        type: g.type,
        volume: g.volume,
        isMuted: g.isMuted,
        isSolo: g.isSolo,
        order: g.order,
        tracks: (tracksByGroup.get(g.id) ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          volume: t.volume,
          pan: t.pan,
          isMuted: t.isMuted,
          isSolo: t.isSolo,
          order: t.order,
          events: (eventsByTrack.get(t.id) ?? []).map((e) => ({
            id: e.id,
            soundAssetId: e.soundAssetId,
            aiEventId: e.aiEventId,
            startTime: e.startTime,
            endTime: e.endTime,
            offset: e.offset,
            volumeOverride: e.volumeOverride,
            fadeIn: e.fadeIn,
            fadeOut: e.fadeOut,
            isUserEdited: e.isUserEdited,
          })),
        })),
      })),
    };

    await projectSnapshotModel.create(projectId, version, snapshotPayload, client);
    await projectModel.update(projectId, { status: "ready" }, client);
  });

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
