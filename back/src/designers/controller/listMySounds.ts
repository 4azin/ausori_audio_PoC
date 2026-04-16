import { Request, Response } from "express";

import { listMySounds as listMySoundsService } from "../service";

/**
 * 내 사운드 목록 조회 컨트롤러
 *
 * 페이지네이션:
 *   GET /api/designers/me/sounds?page=2&limit=10
 *   → req.query.page = "2", req.query.limit = "10" (문자열)
 *   → Number()로 변환, 없으면 기본값 사용
 */
export async function listMySounds(req: Request, res: Response) {
  const userId = req.session.userId!;
  const page = Number(req.query.page) || 1;    // 기본값 1
  const limit = Number(req.query.limit) || 20;  // 기본값 20

  const { rows, total } = await listMySoundsService(userId, { page, limit });

  // API 스펙에 맞게 응답 변환 — category는 id로 반환 (프론트에서 이름 매핑)
  res.status(200).json({
    sounds: rows.map((s) => ({
      id: s.id,
      fileName: s.fileName,
      category: { major: s.majorId, mid: s.midId, sub: s.subId },
      duration: s.duration,
      format: s.format,
      downloadCount: s.downloadCount,
      createdAt: s.createdAt,
    })),
    total,
    page,
    limit,
  });
}
