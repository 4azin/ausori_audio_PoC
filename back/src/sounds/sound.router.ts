import { Router } from "express";

import { isAuthenticated } from "../middleware/auth";
import { getCategoryTree, getSoundById, listSounds } from "./controller";

const router = Router();

router.use(isAuthenticated);

/** 카테고리 트리는 정적 리소스에 가깝지만 로그인 사용자만 쓴다는 가정 */
router.get("/categories", getCategoryTree);

router.get("/", listSounds);
router.get("/:id", getSoundById);

export default router;
