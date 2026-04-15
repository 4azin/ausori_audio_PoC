import { redisClient } from "../config/redis";
import { withTransaction } from "../config/db";
import { embedDocument } from "../config/gemini";
import {
  projectModel,
  trackGroupModel,
  trackModel,
  trackEventModel,
  aiEventModel,
  projectAnalysisModel,
  projectSnapshotModel,
  categoryModel,
  soundAssetModel,
  SnapshotPayload,
  Track,
} from "../models";
import {
  jobRepository,
  JOB_DONE_STREAM,
  JOB_CONSUMER_GROUP,
} from "./job.repository";
import { AiEventPayload, GroupType, JobDoneMessage } from "./types";

const CONSUMER_NAME = `backend-${process.pid}`;
const BLOCK_MS = 5000;
const READ_COUNT = 10;

/** 프로젝트 생성 시 자동 만들 6 트랙 그룹의 표시 순서. */
const DEFAULT_GROUP_ORDER: GroupType[] = [
  "ambience",
  "cinematic",
  "dialogue_vo",
  "foley",
  "sfx",
  "music",
];

let running = false;
let subscriberClient: ReturnType<typeof redisClient.duplicate> | null = null;

/**
 * 한 이벤트에 대한 외부 호출 결과(임베딩 + 카테고리 해석 + vector search) 묶음.
 * 실패한 이벤트는 null. ai_events 에는 가능한 한 모두 INSERT 하지만,
 * track_events 에는 soundAssetId 가 매칭된 것만 배치.
 */
interface EnrichedEvent {
  ev: AiEventPayload;
  embedding: number[];
  resolved: { majorId: number; midId: number; subId: number | null } | null;
  soundAssetId: number | null;
}

async function enrichEvent(ev: AiEventPayload): Promise<EnrichedEvent | null> {
  try {
    const embedding =
      ev.embedding && ev.embedding.length > 0
        ? ev.embedding
        : await embedDocument(ev.description);
    const [majorName, midName, subName] = ev.categoryPath;
    const resolved = await categoryModel.resolvePath(majorName, midName, subName);

    let soundAssetId: number | null = null;
    if (resolved) {
      const hits = await soundAssetModel.vectorSearch(
        {
          majorId: resolved.majorId,
          midId: resolved.midId,
          subId: resolved.subId ?? undefined,
        },
        embedding,
        1,
      );
      soundAssetId = hits[0]?.id ?? null;
    }

    return { ev, embedding, resolved, soundAssetId };
  } catch (err) {
    console.error("[jobs] enrich event failed:", err);
    return null;
  }
}

/** AI 완료 결과를 DB에 반영 — 임베딩/검색은 트랜잭션 밖, 쓰기만 트랜잭션 안. */
async function persistJobResult(payload: JobDoneMessage) {
  const { jobId, projectId, events } = payload;

  // Phase 1: 외부 호출 (Gemini 임베딩 + pgvector 검색). 트랜잭션 밖에서 병렬.
  const enriched = (await Promise.all(events.map(enrichEvent))).filter(
    (x): x is EnrichedEvent => x !== null,
  );

  await withTransaction(async (client) => {
    // 1. 원본 분석 리포트 append-only 보관
    const batch = await projectAnalysisModel.nextBatch(projectId, client);
    const analysis = await projectAnalysisModel.create(
      projectId,
      {
        jobId,
        analysisBatch: batch,
        videoSummary: payload.videoSummary ?? null,
        videoContext: payload.videoContext ?? null,
        rawPayload: payload,
        telemetry: payload.telemetry ?? null,
        completedAt: payload.completedAt,
      },
      client,
    );

    // 2. ai_events bulk INSERT — track_events 매칭 실패한 것도 의도 자산으로 보존
    const aiEvents = await aiEventModel.createMany(
      projectId,
      analysis.id,
      batch,
      enriched.map(({ ev, embedding }) => ({
        groupType: ev.track,
        description: ev.description,
        embedding,
        suggestedStartTime: ev.startTime,
        suggestedEndTime: ev.endTime,
      })),
      client,
    );

    // 3. 라이브 테이블 live-replace
    await trackEventModel.deleteAllByProjectId(projectId, client);
    await trackModel.deleteAllByProjectId(projectId, client);
    await trackGroupModel.deleteAllByProjectId(projectId, client);

    // 4. 기본 6 트랙 그룹
    const groups = await trackGroupModel.createMany(
      projectId,
      DEFAULT_GROUP_ORDER.map((type, idx) => ({
        type,
        volume: 100,
        isMuted: false,
        isSolo: false,
        order: idx + 1,
      })),
      client,
    );
    const groupByType = new Map(groups.map((g) => [g.type, g]));

    // 5. 실제 이벤트가 있는 그룹에만 트랙 1개씩
    const usedGroupTypes = Array.from(new Set(enriched.map((e) => e.ev.track)));
    const trackInputs = usedGroupTypes.map((type) => ({
      groupId: groupByType.get(type)!.id,
      name: type,
      volume: 100,
      pan: 0,
      isMuted: false,
      isSolo: false,
      order: 1,
    }));
    const tracks = await trackModel.createMany(projectId, trackInputs, client);
    const trackByGroupType = new Map<GroupType, Track>();
    usedGroupTypes.forEach((type, i) => trackByGroupType.set(type, tracks[i]));

    // 6. track_events: soundAssetId 가 매칭된 enriched 만 배치.
    //    enriched index 가 곧 aiEvents index (위에서 같은 순서로 INSERT).
    const eventInputs = enriched
      .map((v, i) => ({ v, aiEventId: aiEvents[i].id }))
      .filter(({ v }) => v.soundAssetId != null)
      .map(({ v, aiEventId }) => ({
        trackId: trackByGroupType.get(v.ev.track)!.id,
        soundAssetId: v.soundAssetId!,
        aiEventId,
        startTime: v.ev.startTime,
        endTime: v.ev.endTime,
        offset: 0,
        volumeOverride: 100,
        fadeIn: 0,
        fadeOut: 0,
        isUserEdited: false,
      }));
    const createdEvents = await trackEventModel.createMany(
      projectId,
      eventInputs,
      client,
    );

    // 7. 스냅샷
    const version = await projectSnapshotModel.nextVersion(projectId, client);
    const eventsByTrack = new Map<number, typeof createdEvents>();
    for (const e of createdEvents) {
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

  await jobRepository.cleanup(jobId, projectId);
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
