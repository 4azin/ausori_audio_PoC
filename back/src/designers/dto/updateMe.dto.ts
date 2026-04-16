import { z } from "zod/v4";

export const updateDesignerMeDto = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(1000).optional(),
});
