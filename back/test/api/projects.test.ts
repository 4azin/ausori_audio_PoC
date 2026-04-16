import request from "supertest";
import express from "express";
import { pool } from "../../src/config/db";
import { responseWrapper } from "../../src/middleware/responseWrapper";
import { errorHandler } from "../../src/middleware/errorHandler";
import projectRouter from "../../src/projects/project.router";
import { createTestUser, createTestProject, mockAuth } from "../helpers";

let app: express.Express;
let testUser: { id: number; email: string; name: string };

beforeAll(async () => {
  require("dotenv").config({ path: `${__dirname}/../../.env` });
  await pool.query("SELECT 1");

  testUser = await createTestUser(pool);

  // 테스트용 Express 앱 — 세션 대신 mockAuth 사용
  app = express();
  app.use(express.json());
  app.use(mockAuth(testUser.id));
  app.use(responseWrapper);
  app.use("/api/projects", projectRouter);
  app.use(errorHandler);
});

afterAll(async () => {
  // 테스트 유저의 프로젝트 정리 (CASCADE로 하위 데이터도 삭제)
  await pool.query("DELETE FROM users WHERE id = $1", [testUser.id]);
  await pool.end();
});

describe("Projects API", () => {
  let projectId: number;

  describe("POST /api/projects", () => {
    it("201 — 새 프로젝트 생성", async () => {
      const res = await request(app)
        .post("/api/projects")
        .send({ title: "테스트 프로젝트" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.title).toBe("테스트 프로젝트");
      expect(res.body.data.status).toBe("uploading");
      expect(res.body.data).toHaveProperty("createdAt");
      // userId가 노출되지 않아야 함
      expect(res.body.data).not.toHaveProperty("userId");

      projectId = res.body.data.id;
    });
  });

  describe("GET /api/projects", () => {
    it("200 — 프로젝트 목록 반환", async () => {
      const res = await request(app).get("/api/projects");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("projects");
      expect(res.body.data).toHaveProperty("total");
      expect(res.body.data).toHaveProperty("page");
      expect(res.body.data).toHaveProperty("limit");
      expect(res.body.data.projects.length).toBeGreaterThan(0);

      // userId, originalVideoUrl 노출 안 됨
      const proj = res.body.data.projects[0];
      expect(proj).not.toHaveProperty("userId");
      expect(proj).not.toHaveProperty("originalVideoUrl");
      expect(proj).toHaveProperty("id");
      expect(proj).toHaveProperty("title");
      expect(proj).toHaveProperty("status");
    });
  });

  describe("GET /api/projects/:id", () => {
    it("200 — 프로젝트 상세 반환", async () => {
      const res = await request(app).get(`/api/projects/${projectId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(projectId);
      // userId 노출 안 됨
      expect(res.body.data).not.toHaveProperty("userId");
      expect(res.body.data).toHaveProperty("title");
      expect(res.body.data).toHaveProperty("status");
    });

    it("404 — 존재하지 않는 프로젝트", async () => {
      const res = await request(app).get("/api/projects/999999");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("PATCH /api/projects/:id", () => {
    it("200 — 제목 수정", async () => {
      const res = await request(app)
        .patch(`/api/projects/${projectId}`)
        .send({ title: "수정된 제목" });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(projectId);
      expect(res.body.data.title).toBe("수정된 제목");
    });
  });

  describe("DELETE /api/projects/:id", () => {
    it("200 — 프로젝트 삭제", async () => {
      const res = await request(app).delete(`/api/projects/${projectId}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });

    it("삭제 후 조회 시 404", async () => {
      const res = await request(app).get(`/api/projects/${projectId}`);
      expect(res.status).toBe(404);
    });
  });
});
