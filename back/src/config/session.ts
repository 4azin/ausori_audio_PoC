import { RedisStore } from "connect-redis";

import { redisClient } from "./redis/client";

/** 세션 설정 — Redis를 세션 스토어로 사용 */
export const sessionConfig = {
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET || "dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24, // 24시간
  },
};
