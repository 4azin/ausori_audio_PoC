import { Router } from "express";

import { validate } from "../middleware/validate";
import { isAuthenticated } from "../middleware/auth";
import { createProjectDto, updateProjectDto } from "./dto";
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
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

export default router;
