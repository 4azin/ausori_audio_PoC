import { Request, Response } from "express";
import { userService } from "../service";
import { createUserDto } from "../dto";

/** 유저 생성 — req.body를 검증 후 service에 위임 */
export async function createUser(req: Request, res: Response) {
  const parsed = createUserDto.parse(req.body);
  const user = await userService.createUser(parsed.email, parsed.nickname);
  res.status(201).json(user);
}
