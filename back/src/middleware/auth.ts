import { RequestHandler } from "express";
import { unAuthError, alreadyLoggedInError } from "./customError";

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
