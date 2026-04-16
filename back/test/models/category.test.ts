import { pool } from "../../src/config/db";
import { categoryModel } from "../../src/models/category.model";

beforeAll(async () => {
  require("dotenv").config({ path: `${__dirname}/../../.env` });
  await pool.query("SELECT 1");
});
afterAll(async () => {
  await pool.end();
});

describe("categoryModel", () => {
  describe("findAllMajors", () => {
    it("6개 대분류 반환", async () => {
      const majors = await categoryModel.findAllMajors();
      expect(majors.length).toBe(6);
      const names = majors.map((m) => m.name);
      expect(names).toContain("Ambience");
      expect(names).toContain("SFX");
      expect(names).toContain("Music");
    });
  });

  describe("findMidsByMajor", () => {
    it("대분류 ID로 중분류 목록 조회", async () => {
      const majors = await categoryModel.findAllMajors();
      const ambience = majors.find((m) => m.name === "Ambience")!;

      const mids = await categoryModel.findMidsByMajor(ambience.id);
      expect(mids.length).toBeGreaterThan(0);
      expect(mids[0]).toHaveProperty("id");
      expect(mids[0]).toHaveProperty("name");
      expect(mids[0]).toHaveProperty("majorId");
      expect(mids[0].majorId).toBe(ambience.id);
    });
  });

  describe("resolvePath", () => {
    it("유효한 카테고리 경로 해석", async () => {
      const result = await categoryModel.resolvePath("Ambience", "Weather", "Rain");

      // Rain이 없을 수 있으니 major/mid만 필수 체크
      expect(result).not.toBeNull();
      expect(Number(result!.majorId)).toBeGreaterThan(0);
      expect(Number(result!.midId)).toBeGreaterThan(0);
    });

    it("존재하지 않는 대분류는 null 반환", async () => {
      const result = await categoryModel.resolvePath("NonExistent", "Weather", "Rain");
      expect(result).toBeNull();
    });

    it("존재하지 않는 중분류는 null 반환", async () => {
      const result = await categoryModel.resolvePath("Ambience", "NonExistent", "Rain");
      expect(result).toBeNull();
    });
  });
});
