"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/env";
import { updateLocalProductionStep } from "@/lib/local-store";
import { getOrder } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { updateStepSchema, type UpdateStepInput } from "@/lib/validation/production";

export type UpdateStepResult = {
  status: "success" | "error";
  message: string;
};

export async function updateProductionStep(
  input: UpdateStepInput,
): Promise<UpdateStepResult> {
  const user = await requireSession(["admin", "manager", "operator"]);
  const parsed = updateStepSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Accion de produccion invalida.",
    };
  }
  const currentOrder = await getOrder(parsed.data.orderId);
  const currentStep = currentOrder?.steps.find((step) => step.key === parsed.data.stepKey);
  if (!currentStep) return { status: "error", message: "No se encontró la etapa seleccionada." };
  if (!isAllowedTransition(currentStep.status, parsed.data.status)) {
    return { status: "error", message: "La etapa cambió de estado. Actualiza la vista e intenta nuevamente." };
  }
  const settings = await getSystemSettings();
  if (
    parsed.data.status === "blocked" &&
    settings.permissions.requireBlockReason &&
    (!parsed.data.reason || parsed.data.reason.length < 5)
  ) {
    return { status: "error", message: "Describe brevemente por qué se bloquea la etapa." };
  }

  if (user.role === "operator") {
    const permissions = settings.permissions;
    const allowed =
      (parsed.data.status === "active" && permissions.operatorsCanStartSteps) ||
      (parsed.data.status === "done" && permissions.operatorsCanCompleteSteps) ||
      (parsed.data.status === "blocked" && permissions.operatorsCanBlockSteps);
    if (!allowed) return { status: "error", message: "Esta acción está deshabilitada para operarios." };
  }

  if (!hasSupabaseConfig()) {
    if (user.role === "operator" && (!user.area || user.area !== parsed.data.stepKey)) {
      return {
        status: "error",
        message: "Tu perfil solo puede actualizar su area asignada.",
      };
    }

    const updated = await updateLocalProductionStep({
      ...parsed.data,
      autoCompleteAfterQuality: settings.production.autoCompleteAfterQuality,
    });
    if (!updated) {
      return {
        status: "error",
        message: "No se encontro la etapa seleccionada.",
      };
    }

    revalidatePath("/admin");
    revalidatePath("/taller");
    revalidatePath(`/admin/orders/${parsed.data.orderId}`);

    return {
      status: "success",
      message: "Etapa actualizada.",
    };
  }

  const supabase = await createClient();
  if (user.role === "operator" && (!user.area || user.area !== parsed.data.stepKey)) {
    return {
      status: "error",
      message: "Tu perfil solo puede actualizar su area asignada.",
    };
  }
  const now = new Date().toISOString();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", auth.user?.id ?? "")
    .maybeSingle();
  if (!profile) return { status: "error", message: "No se pudo identificar tu perfil." };
  const patch = {
    status: parsed.data.status,
    notes: parsed.data.status === "blocked" ? parsed.data.reason : null,
    started_at: parsed.data.status === "active" ? now : undefined,
    completed_at: parsed.data.status === "done" ? now : undefined,
    updated_by: profile?.id,
  };

  const { data: updated, error } = await supabase
    .from("production_steps")
    .update(patch)
    .eq("order_id", parsed.data.orderId)
    .eq("step", parsed.data.stepKey)
    .select("id");

  if (error || !updated?.length) {
    return {
      status: "error",
      message: error?.message ?? "La etapa no pudo actualizarse con los permisos actuales.",
    };
  }
  if (
    parsed.data.stepKey === "quality" &&
    parsed.data.status === "done" &&
    settings.production.autoCompleteAfterQuality
  ) {
    if (!hasSupabaseAdminConfig()) {
      return { status: "error", message: "La etapa se completó, pero falta configurar la clave de servicio para cerrar la orden." };
    }
    const { error: closeError } = await getSupabaseAdmin()
      .from("orders")
      .update({ status: "completed", condition: "delivered", completed_at: now })
      .eq("id", parsed.data.orderId);
    if (closeError) return { status: "error", message: `La etapa se completó, pero no se pudo cerrar la orden: ${closeError.message}` };
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    order_id: parsed.data.orderId,
    action: "update_step",
    entity: "production_steps",
    profile_id: profile?.id,
    field_name: "status",
    new_value: parsed.data.reason
      ? `${parsed.data.status}: ${parsed.data.reason}`
      : parsed.data.status,
  });
  if (auditError) return { status: "error", message: `La etapa cambió, pero no se pudo registrar la auditoría: ${auditError.message}` };

  revalidatePath("/admin");
  revalidatePath("/taller");
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  revalidatePath(`/taller/orders/${parsed.data.orderId}`);

  return {
    status: "success",
    message: "Etapa actualizada.",
  };
}

function isAllowedTransition(current: UpdateStepInput["status"], next: UpdateStepInput["status"]) {
  if (current === "pending") return next === "active" || next === "blocked";
  if (current === "active") return next === "done" || next === "blocked";
  if (current === "blocked") return next === "active";
  return false;
}
