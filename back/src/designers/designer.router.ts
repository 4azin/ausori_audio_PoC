import { Router } from "express";

import { validate } from "../middleware/validate";
import { upload } from "../middleware/upload";
import { isAuthenticated, isDesigner } from "../middleware/auth";
import { registerDto, updateDesignerMeDto, updateSoundDto } from "./dto";
import {
  register, getMe, updateMe,
  listMySounds, uploadSound, updateSound, deleteSound,
} from "./controller";

/**
 * Designer 라우터 — /api/designers 아래 모든 엔드포인트 정의
 *
 * 미들웨어 체인 읽는 법 (왼쪽 → 오른쪽 순서로 실행):
 *   isAuthenticated → 로그인 확인 (세션에 userId 있는지)
 *   isDesigner      → role이 designer/admin인지 확인
 *   validate(dto)   → req.body를 zod 스키마로 검증
 *   upload(...)     → multipart/form-data 파일 파싱 (multer)
 *   controller      → 실제 요청 처리
 */
const router = Router();

// register만 isDesigner 없음 — 아직 user이니까 (등록 후 designer로 승격)
router.post("/register",
  isAuthenticated,
  validate(registerDto),
  register,
);

// 아래부터는 전부 isDesigner 필요 (designer 등록 완료 후에만 접근 가능)
router.get("/me",
  isAuthenticated,
  isDesigner,
  getMe,
);

router.patch("/me",
  isAuthenticated,
  isDesigner,
  validate(updateDesignerMeDto),
  updateMe,
);

router.get("/me/sounds",
  isAuthenticated,
  isDesigner,
  listMySounds,
);

// upload()가 validate() 대신 들어감 — multipart/form-data는 JSON이 아니라 zod 검증 불가
router.post("/me/sounds",
  isAuthenticated,
  isDesigner,
  upload({ allow: "audio" }),
  uploadSound,
);

// :soundId — URL 파라미터, controller에서 Number(req.params.soundId)로 추출
router.patch("/me/sounds/:soundId",
  isAuthenticated,
  isDesigner,
  validate(updateSoundDto),
  updateSound,
);

router.delete("/me/sounds/:soundId",
  isAuthenticated,
  isDesigner,
  deleteSound,
);

export default router;
