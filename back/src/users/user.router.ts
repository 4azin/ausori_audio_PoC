import { Router } from "express";

import { validate } from "../middleware/validate";
import { createUserDto, updateUserDto } from "./dto";
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
    validate(createUserDto),
    createUser
);

router.patch("/:id",
    validate(updateUserDto),
    updateUser
);

router.delete("/:id",
    deleteUser
);

export default router;
