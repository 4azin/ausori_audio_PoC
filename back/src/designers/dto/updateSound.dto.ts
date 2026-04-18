import { z } from "zod/v4";

export const updateSoundDto = z.object({
  tags: z.array(z.string()).optional(),
  description: z.string().optional(),
  mood: z.array(z.string()).optional(),
});
