import { Request, Response } from "express";
import { userService } from "../service";

/** ID로 유저 단건 조회 */
export async function getUserById(req: Request, res: Response) {
  const id = Number(req.params.id);
  const user = await userService.getUserById(id);
  res.status(200).json(user);
}
