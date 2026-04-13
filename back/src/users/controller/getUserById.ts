import { Request, Response } from "express";

import { getUserById as getUserByIdService } from "../service";

/** ID로 유저 단건 조회 */
export async function getUserById(req: Request, res: Response) {
  const id = Number(req.params.id);
  const user = await getUserByIdService(id);

  res.status(200).json(user);
}
