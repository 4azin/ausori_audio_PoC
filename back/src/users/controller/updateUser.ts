import { Request, Response } from "express";
import { userService } from "../service";
import { updateUserDto } from "../dto";

/** 유저 수정 — req.body를 검증 후 service에 위임 */
export async function updateUser(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = updateUserDto.parse(req.body);
  const user = await userService.updateUser(id, parsed);
  res.status(200).json(user);
}
