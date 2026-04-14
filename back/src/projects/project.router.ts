import { Router } from "express";

import { validate } from "../middleware/validate";
import { isAuthenticated } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { createProjectDto, updateProjectDto, saveProjectDto } from "./dto";
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  saveProject,
  loadProject,
  uploadVideo,
  getStatus,
} from "./controller";

/** Project 라우터 — URL과 핸들러 매핑만 담당 */
const router = Router();

/** 프로젝트 API는 로그인 필수 */
router.use(isAuthenticated);

router.get("/",
    getProjects
);

router.get("/:id",
    getProjectById
);

router.post("/",
    validate(createProjectDto),
    createProject
);

router.patch("/:id",
    validate(updateProjectDto),
    updateProject
);

router.delete("/:id",
    deleteProject
);

/** 에디터 상태 저장 / 로드 */
router.post("/:id/save",
    validate(saveProjectDto),
    saveProject
);

router.get("/:id/load",
    loadProject
);

/** 영상 업로드 */
router.post("/:id/video",
    upload({ allow: "video", maxSize: 500_000_000 }),
    uploadVideo
);

/** AI 분석 진행 상태 조회 (폴링용) */
router.get("/:id/status",
    getStatus
);

export default router;
