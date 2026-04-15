import { Request, Response } from "express";

import { getCategoryTree as getCategoryTreeService } from "../service";

export async function getCategoryTree(_req: Request, res: Response) {
  const tree = await getCategoryTreeService();
  res.status(200).json({ categories: tree });
}
