import { z } from "zod";

export const updateStepSchema = z.object({
  orderId: z.string().min(1),
  stepKey: z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/),
  status: z.enum(["pending", "active", "done", "blocked"]),
  reason: z.string().trim().max(500).optional(),
  noteOnly: z.boolean().optional(),
});

export type UpdateStepInput = z.infer<typeof updateStepSchema>;
