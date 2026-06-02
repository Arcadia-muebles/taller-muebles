"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { updateStepSchema, type UpdateStepInput } from "@/lib/validation/production";

export type UpdateStepResult = {
  status: "success" | "error";
  message: string;
};

export async function updateProductionStep(
  input: UpdateStepInput,
): Promise<UpdateStepResult> {
  const parsed = updateStepSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Accion de produccion invalida.",
    };
  }

  if (!hasSupabaseConfig()) {
    return {
      status: "success",
      message: "Modo demo: etapa actualizada localmente.",
    };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const patch = {
    status: parsed.data.status,
    started_at: parsed.data.status === "active" ? now : undefined,
    completed_at: parsed.data.status === "done" ? now : undefined,
  };

  const { error } = await supabase
    .from("production_steps")
    .update(patch)
    .eq("order_id", parsed.data.orderId)
    .eq("step", parsed.data.stepKey);

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  await supabase.from("audit_logs").insert({
    order_id: parsed.data.orderId,
    action: "update_step",
    entity: "production_steps",
    field_name: "status",
    new_value: parsed.data.status,
  });

  revalidatePath("/admin");
  revalidatePath("/taller");
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);

  return {
    status: "success",
    message: "Etapa actualizada.",
  };
}
