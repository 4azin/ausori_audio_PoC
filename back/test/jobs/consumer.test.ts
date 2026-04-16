import { pool, query } from "../../src/config/db";
import { persistJobResult } from "../../src/jobs";
import { createTestUser, createTestProject } from "../helpers";
import {
  normalJobDone,
  mismatchCategoryJobDone,
  emptyEventsJobDone,
  allTracksJobDone,
} from "../fixtures/jobDoneMessages";

// Gemini embedDocument를 mock — 실제 API 호출 방지
jest.mock("../../src/config/gemini", () => ({
  initGemini: jest.fn(),
  getGeminiClient: jest.fn(),
  embedDocument: jest.fn().mockResolvedValue(new Array(3072).fill(0.01)),
  embedQuery: jest.fn().mockResolvedValue(new Array(3072).fill(0.01)),
}));

// jobRepository를 mock — Redis 불필요
jest.mock("../../src/jobs/job.repository", () => ({
  jobRepository: {
    cleanup: jest.fn().mockResolvedValue(undefined),
    ensureConsumerGroup: jest.fn().mockResolvedValue(undefined),
    enqueue: jest.fn().mockResolvedValue(undefined),
    linkProjectJob: jest.fn().mockResolvedValue(undefined),
  },
  JOB_DONE_STREAM: "job:done",
  JOB_CONSUMER_GROUP: "backend-consumers",
}));

let testUser: { id: number };

beforeAll(async () => {
  require("dotenv").config({ path: `${__dirname}/../../.env` });
  await pool.query("SELECT 1");
  testUser = await createTestUser(pool);
});

afterAll(async () => {
  await pool.query("DELETE FROM users WHERE id = $1", [testUser.id]);
  await pool.end();
});

/** 각 테스트마다 새 프로젝트 생성 (격리) */
async function freshProject() {
  return createTestProject(pool, testUser.id, { status: "analyzing" });
}

describe("persistJobResult", () => {
  describe("정상 케이스 (normalJobDone)", () => {
    let projectId: number;

    beforeAll(async () => {
      const project = await freshProject();
      projectId = project.id;
      await persistJobResult(normalJobDone(projectId));
    });

    it("project_analyses에 리포트 저장", async () => {
      const res = await query(
        `SELECT * FROM project_analyses WHERE project_id = $1`,
        [projectId],
      );
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].video_summary).toContain("도시 풍경");
      expect(res.rows[0].raw_payload).toBeTruthy();
    });

    it("ai_events에 이벤트 전부 저장", async () => {
      const res = await query(
        `SELECT * FROM ai_events WHERE project_id = $1 ORDER BY id`,
        [projectId],
      );
      expect(res.rows.length).toBe(4);
      expect(res.rows[0].group_type).toBe("ambience");
      expect(res.rows[2].group_type).toBe("sfx");
      expect(res.rows[3].group_type).toBe("foley");
    });

    it("track_groups 6개 생성", async () => {
      const res = await query(
        `SELECT * FROM track_groups WHERE project_id = $1 ORDER BY "order"`,
        [projectId],
      );
      expect(res.rows.length).toBe(6);
      const types = res.rows.map((r: any) => r.type);
      expect(types).toEqual([
        "ambience", "cinematic", "dialogue_vo", "foley", "sfx", "music",
      ]);
    });

    it("이벤트가 있는 그룹에만 트랙 생성", async () => {
      const res = await query(
        `SELECT * FROM tracks WHERE project_id = $1`,
        [projectId],
      );
      // ambience, sfx, foley 3개 그룹에 이벤트 있음
      expect(res.rows.length).toBe(3);
    });

    it("track_events는 매칭된 것만 생성", async () => {
      const res = await query(
        `SELECT * FROM track_events WHERE project_id = $1`,
        [projectId],
      );
      // 카테고리 매칭 성공한 이벤트만 들어감
      expect(res.rows.length).toBeGreaterThan(0);
    });

    it("snapshot version 1 생성", async () => {
      const res = await query(
        `SELECT * FROM project_snapshots WHERE project_id = $1`,
        [projectId],
      );
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].version).toBe(1);
      expect(res.rows[0].snapshot).toHaveProperty("trackGroups");
    });

    it("project status가 ready로 변경", async () => {
      const res = await query(
        `SELECT status FROM projects WHERE id = $1`,
        [projectId],
      );
      expect(res.rows[0].status).toBe("ready");
    });
  });

  describe("빈 이벤트 케이스 (emptyEventsJobDone)", () => {
    let projectId: number;

    beforeAll(async () => {
      const project = await freshProject();
      projectId = project.id;
      await persistJobResult(emptyEventsJobDone(projectId));
    });

    it("track_groups 6개는 여전히 생성", async () => {
      const res = await query(
        `SELECT * FROM track_groups WHERE project_id = $1`,
        [projectId],
      );
      expect(res.rows.length).toBe(6);
    });

    it("tracks는 0개", async () => {
      const res = await query(
        `SELECT * FROM tracks WHERE project_id = $1`,
        [projectId],
      );
      expect(res.rows.length).toBe(0);
    });

    it("track_events는 0개", async () => {
      const res = await query(
        `SELECT * FROM track_events WHERE project_id = $1`,
        [projectId],
      );
      expect(res.rows.length).toBe(0);
    });

    it("snapshot은 생성됨 (빈 트랙 그룹)", async () => {
      const res = await query(
        `SELECT * FROM project_snapshots WHERE project_id = $1`,
        [projectId],
      );
      expect(res.rows.length).toBe(1);
      const snapshot = res.rows[0].snapshot;
      expect(snapshot.trackGroups.length).toBe(6);
      // 모든 그룹의 tracks가 비어 있어야 함
      for (const g of snapshot.trackGroups) {
        expect(g.tracks.length).toBe(0);
      }
    });
  });

  describe("카테고리 불일치 케이스 (mismatchCategoryJobDone)", () => {
    let projectId: number;

    beforeAll(async () => {
      const project = await freshProject();
      projectId = project.id;
      await persistJobResult(mismatchCategoryJobDone(projectId));
    });

    it("ai_events에는 저장됨 (의도 보존)", async () => {
      const res = await query(
        `SELECT * FROM ai_events WHERE project_id = $1`,
        [projectId],
      );
      expect(res.rows.length).toBe(1);
    });

    it("track_events에는 안 들어감 (매칭 실패)", async () => {
      const res = await query(
        `SELECT * FROM track_events WHERE project_id = $1`,
        [projectId],
      );
      expect(res.rows.length).toBe(0);
    });
  });

  describe("전체 트랙 사용 케이스 (allTracksJobDone)", () => {
    let projectId: number;

    beforeAll(async () => {
      const project = await freshProject();
      projectId = project.id;
      await persistJobResult(allTracksJobDone(projectId));
    });

    it("6개 트랙 타입 전부에 이벤트 배치 시도", async () => {
      const res = await query(
        `SELECT * FROM ai_events WHERE project_id = $1`,
        [projectId],
      );
      expect(res.rows.length).toBe(6);
      const types = new Set(res.rows.map((r: any) => r.group_type));
      expect(types.size).toBe(6);
    });

    it("매칭된 트랙에 track_events 생성", async () => {
      const tracks = await query(
        `SELECT * FROM tracks WHERE project_id = $1`,
        [projectId],
      );
      // 6개 그룹 전부에 이벤트가 있으므로 트랙도 6개 (카테고리 매칭 실패 제외)
      expect(tracks.rows.length).toBeGreaterThan(0);
      expect(tracks.rows.length).toBeLessThanOrEqual(6);
    });
  });
});
