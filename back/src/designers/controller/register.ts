import { Request, Response } from "express";

import { register as registerService } from "../service";

/**
 * 디자이너 온보딩 컨트롤러
 *
 * 컨트롤러의 역할: HTTP 입출력만 담당 (비즈니스 로직은 service에)
 *   1. req에서 데이터 추출
 *   2. service 함수 호출
 *   3. 응답 필드 선택해서 res.json()
 */
export async function register(req: Request, res: Response) {
  const userId = req.session.userId!;  // isAuthenticated 통과했으므로 반드시 존재 (! = non-null assertion)
  const { displayName, bio } = req.body;  // validate(registerDto) 통과한 검증된 데이터

  const { designer, role } = await registerService(userId, { displayName, bio });

  // 세션에 새 role 즉시 반영 — 이후 요청부터 isDesigner 미들웨어 통과 가능
  req.session.userRole = role;

  // API 스펙에 맞는 필드만 선택해서 응답 (responseWrapper가 { success: true, data: ... }로 감쌈)
  res.status(201).json({
    id: designer.id,
    userId: designer.userId,
    displayName: designer.displayName,
    bio: designer.bio,
    revenueShareRate: designer.revenueShareRate,
    role,
    createdAt: designer.createdAt,
  });
}
