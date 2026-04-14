import { Request, Response } from "express";

import { deleteUser as deleteUserService } from "../service";

/** 유저 삭제 */
export async function deleteUser(req: Request<{ id: string }>, res: Response) {
  const id = Number(req.params.id);
  await deleteUserService(id);

  res.status(204).send();
}
