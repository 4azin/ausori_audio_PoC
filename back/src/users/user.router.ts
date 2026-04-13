import { Router } from "express";
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "./controller";

/** User 라우터 — URL과 핸들러 매핑만 담당 */
const router = Router();

router.get("/",
    getUsers
);

router.get("/:id",
    getUserById
);

router.post("/",
    createUser
);

router.patch("/:id",
    updateUser
);

router.delete("/:id",
    deleteUser
);

export default router;
