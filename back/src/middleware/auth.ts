import { RequestHandler } from "express";

import { unAuthError, alreadyLoggedInError, forbiddenError } from "./customError";

/** 로그인 여부 확인 — 세션에 userId가 있어야 통과 */
export const isAuthenticated: RequestHandler = (req, _res, next) => {
  if (!req.session.userId) {
    throw unAuthError();
  }

  next();
};

/** 비로그인 여부 확인 — 세션에 userId가 없어야 통과 */
export const isNotAuthenticated: RequestHandler = (req, _res, next) => {
  if (req.session.userId) {
    throw alreadyLoggedInError();
  }

  next();
};

/** 디자이너 전용 — role이 designer 또는 admin이어야 통과 */
export const isDesigner: RequestHandler = (req, _res, next) => {
  const role = req.session.userRole;

  if (role !== "designer" && role !== "admin") {
    throw forbiddenError("사운드 디자이너만 접근할 수 있습니다");
  }

  next();
};
