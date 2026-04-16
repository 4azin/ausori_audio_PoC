import request from "supertest";
import express from "express";
import { pool } from "../../src/config/db";
import { responseWrapper } from "../../src/middleware/responseWrapper";
import { errorHandler } from "../../src/middleware/errorHandler";
import soundRouter from "../../src/sounds/sound.router";
import { mockAuth } from "../helpers";

let app: express.Express;

beforeAll(async () => {
  require("dotenv").config({ path: `${__dirname}/../../.env` });
  await pool.query("SELECT 1");

  app = express();
  app.use(express.json());
  app.use(mockAuth(1)); // 임의 userId
  app.use(responseWrapper);
  app.use("/api/sounds", soundRouter);
  app.use(errorHandler);
});

afterAll(async () => {
  await pool.end();
});

describe("Sounds API", () => {
  describe("GET /api/sounds/categories", () => {
    it("200 — 카테고리 트리 반환", async () => {
      const res = await request(app).get("/api/sounds/categories");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // data가 배열이어야 함 (categories 래핑 없이)
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(6); // 6개 대분류

      const major = res.body.data[0];
      expect(major).toHaveProperty("id");
      expect(major).toHaveProperty("name");
      expect(major).toHaveProperty("children");
      expect(Array.isArray(major.children)).toBe(true);

      // 중분류에도 children 있어야 함
      if (major.children.length > 0) {
        const mid = major.children[0];
        expect(mid).toHaveProperty("id");
        expect(mid).toHaveProperty("name");
        expect(mid).toHaveProperty("children");
      }
    });
  });
});
