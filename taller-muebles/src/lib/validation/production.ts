import { z } from "zod";

export const updateStepSchema = z.object({
  orderId: z.string().min(1),
  stepKey: z.enum(["structure", "cutting", "sewing", "upholstery", "quality"]),
  status: z.enum(["pending", "active", "done", "blocked"]),
  reason: z.string().trim().max(500).optional(),
});

export type UpdateStepInput = z.infer<typeof updateStepSchema>;
