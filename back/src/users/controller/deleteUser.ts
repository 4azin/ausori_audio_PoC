import { Request, Response } from "express";
import { userService } from "../service";

/** 유저 삭제 */
export async function deleteUser(req: Request, res: Response) {
  const id = Number(req.params.id);
  await userService.deleteUser(id);
  res.status(204).send();
}
