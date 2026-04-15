import { Router } from "express";

import { validate } from "../middleware/validate";
import { isAuthenticated, isNotAuthenticated } from "../middleware/auth";
import { googleLoginDto, updateMeDto } from "./dto";
import { googleLogin, logout, getMe, updateMe, deleteMe, devLogin } from "./controller";

/** User 라우터 — URL과 핸들러 매핑만 담당 */
const router = Router();

/** 개발용 임시 로그인 — production에서는 비활성화 */
if (process.env.NODE_ENV !== "production") {
  router.post("/dev-login", devLogin);
}

/** 비로그인 전용 — 이미 로그인 상태면 에러 */
router.post("/google",
  isNotAuthenticated,
  validate(googleLoginDto),
  googleLogin
);

/** 로그인 전용 */
router.post("/logout",
  isAuthenticated,
  logout
);

router.get("/me",
  isAuthenticated,
  getMe
);

router.patch("/me",
  isAuthenticated,
  validate(updateMeDto),
  updateMe
);

router.delete("/me",
  isAuthenticated,
  deleteMe
);

export default router;
