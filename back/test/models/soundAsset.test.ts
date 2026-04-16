import { pool } from "../../src/config/db";
import { soundAssetModel } from "../../src/models/soundAsset.model";

// DB 연결/해제
beforeAll(async () => {
  require("dotenv").config({ path: `${__dirname}/../../.env` });
  await pool.query("SELECT 1");
});
afterAll(async () => {
  await pool.end();
});

describe("soundAssetModel", () => {
  describe("findPlaybackByIds", () => {
    it("빈 배열이면 빈 결과 반환", async () => {
      const result = await soundAssetModel.findPlaybackByIds([]);
      expect(result).toEqual([]);
    });

    it("존재하는 ID로 에셋 조회", async () => {
      const result = await soundAssetModel.findPlaybackByIds([1]);
      expect(result).toHaveLength(1);
      expect(Number(result[0].id)).toBe(1);
      expect(result[0]).toHaveProperty("fileName");
      expect(result[0]).toHaveProperty("s3Key");
      expect(result[0]).toHaveProperty("duration");
      expect(result[0]).toHaveProperty("format");
    });
  });

  describe("findCategoryById", () => {
    it("존재하는 에셋의 카테고리 ID 반환", async () => {
      const cat = await soundAssetModel.findCategoryById(1);
      expect(cat).not.toBeNull();
      expect(cat).toHaveProperty("majorId");
      expect(cat).toHaveProperty("midId");
      expect(cat).toHaveProperty("subId");
      expect(cat!.majorId).toBeTruthy();
    });

    it("존재하지 않는 ID는 null 반환", async () => {
      const cat = await soundAssetModel.findCategoryById(999999);
      expect(cat).toBeNull();
    });
  });

  describe("findEmbeddingById", () => {
    it("존재하는 에셋의 임베딩 벡터 반환", async () => {
      const embedding = await soundAssetModel.findEmbeddingById(1);
      expect(embedding).not.toBeNull();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding!.length).toBe(3072);
      expect(typeof embedding![0]).toBe("number");
    });

    it("존재하지 않는 ID는 null 반환", async () => {
      const embedding = await soundAssetModel.findEmbeddingById(999999);
      expect(embedding).toBeNull();
    });
  });

  describe("vectorSearch", () => {
    let queryVec: number[];

    beforeAll(async () => {
      // 첫 번째 에셋의 임베딩을 쿼리 벡터로 사용
      queryVec = (await soundAssetModel.findEmbeddingById(1))!;
    });

    it("카테고리 필터로 유사 에셋 검색", async () => {
      const cat = await soundAssetModel.findCategoryById(1);
      const hits = await soundAssetModel.vectorSearch(
        { majorId: cat!.majorId, midId: cat!.midId },
        queryVec,
        5,
      );

      expect(hits.length).toBeGreaterThan(0);
      expect(hits.length).toBeLessThanOrEqual(5);
      expect(hits[0]).toHaveProperty("id");
      expect(hits[0]).toHaveProperty("similarity");
      // 자기 자신이 가장 유사 (similarity ≈ 1)
      expect(hits[0].similarity).toBeGreaterThan(0.99);
    });
  });

  describe("similarSearch", () => {
    let queryVec: number[];
    let cat: { majorId: number; midId: number; subId: number };

    beforeAll(async () => {
      queryVec = (await soundAssetModel.findEmbeddingById(1))!;
      cat = (await soundAssetModel.findCategoryById(1))!;
    });

    it("level=major로 넓은 범위 검색", async () => {
      const hits = await soundAssetModel.similarSearch(
        { level: "major", majorId: cat.majorId },
        queryVec,
        10,
      );

      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0]).toHaveProperty("fileName");
      expect(hits[0]).toHaveProperty("category");
      expect(hits[0].category).toHaveProperty("major");
      expect(hits[0].category).toHaveProperty("mid");
      expect(hits[0].category).toHaveProperty("sub");
      expect(hits[0]).toHaveProperty("mood");
      expect(hits[0]).toHaveProperty("tags");
      expect(hits[0]).toHaveProperty("similarity");
    });

    it("level=sub로 좁은 범위 검색", async () => {
      const hits = await soundAssetModel.similarSearch(
        { level: "sub", majorId: cat.majorId, midId: cat.midId, subId: cat.subId },
        queryVec,
        5,
      );

      expect(hits.length).toBeGreaterThan(0);
      // similarity 내림차순 정렬 확인
      for (let i = 1; i < hits.length; i++) {
        expect(hits[i - 1].similarity).toBeGreaterThanOrEqual(hits[i].similarity);
      }
    });

    it("excludeId로 자기 자신 제외", async () => {
      const hits = await soundAssetModel.similarSearch(
        { level: "major", majorId: cat.majorId, excludeId: 1 },
        queryVec,
        10,
      );

      const ids = hits.map((h) => h.id);
      expect(ids).not.toContain(1);
    });

    it("offset 페이지네이션 동작", async () => {
      const page1 = await soundAssetModel.similarSearch(
        { level: "major", majorId: cat.majorId },
        queryVec,
        5,
        0,
      );
      const page2 = await soundAssetModel.similarSearch(
        { level: "major", majorId: cat.majorId },
        queryVec,
        5,
        5,
      );

      // 두 페이지의 ID가 겹치지 않아야 함
      const ids1 = new Set(page1.map((h) => h.id));
      for (const h of page2) {
        expect(ids1.has(h.id)).toBe(false);
      }
    });
  });
});
