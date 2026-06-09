"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/env";
import { createLocalOrder, updateLocalProductionStep } from "@/lib/local-store";
import { getOrder, listUsers } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { updateStepSchema, type UpdateStepInput } from "@/lib/validation/production";
import { canWorkerUseStep } from "@/lib/workshop-access";

export type UpdateStepResult = {
  status: "success" | "error";
  message: string;
};

export type WorkshopOrderState = {
  status: "idle" | "success" | "error";
  message: string;
  orderId?: string;
};

const workshopOrderSchema = z.object({
  store: z.enum(["LH", "LR"]),
  clientName: z.string().trim().max(80).optional(),
  productName: z.string().trim().min(2, "Ingresa el producto o modelo."),
  material: z.string().trim().max(80).optional(),
  color: z.string().trim().max(60).optional(),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ingresa una fecha valida."),
  priority: z.enum(["normal", "high", "critical"]),
  observations: z.string().trim().max(500).optional(),
});

export async function createWorkshopOrder(
  _prevState: WorkshopOrderState,
  formData: FormData,
): Promise<WorkshopOrderState> {
  const user = await requireSession(["operator"]);
  const settings = await getSystemSettings();
  const parsed = workshopOrderSchema.safeParse({
    store: formData.get("store"),
    clientName: formData.get("clientName")?.toString() || undefined,
    productName: formData.get("productName"),
    material: formData.get("material")?.toString() || undefined,
    color: formData.get("color")?.toString() || undefined,
    deliveryDate: formData.get("deliveryDate"),
    priority: formData.get("priority"),
    observations: formData.get("observations")?.toString() || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los datos del producto." };
  }

  const salesNoteNumber = `TALLER-${Date.now().toString(36).toUpperCase()}`;
  const entryDate = new Date().toISOString().slice(0, 10);
  const input = {
    store: parsed.data.store,
    salesNoteNumber,
    clientName: parsed.data.clientName || "Trabajo interno",
    productName: parsed.data.productName,
    material: parsed.data.material || "Por definir",
    color: parsed.data.color || "Por definir",
    entryDate,
    deliveryDate: parsed.data.deliveryDate,
    priority: parsed.data.priority,
    assignedTo: user.name,
    observations: parsed.data.observations || "Ingresado desde panel de taller.",
    isWarranty: false,
  };

  if (!hasSupabaseConfig()) {
    const order = await createLocalOrder({
      ...input,
      steps: settings.production.steps,
    });
    revalidatePath("/admin");
    revalidatePath("/taller");
    return { status: "success", message: "Producto ingresado al flujo de taller.", orderId: order.id };
  }

  const supabase = await createClient();
  const profileId = await getCurrentProfileId(supabase);
  if (!profileId) return { status: "error", message: "No se pudo identificar tu perfil." };

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id")
    .eq("code", input.store)
    .single();
  if (storeError || !store) {
    return { status: "error", message: storeError?.message ?? "No se encontro la tienda seleccionada." };
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      store_id: store.id,
      internal_code: input.salesNoteNumber,
      sales_note_number: input.salesNoteNumber,
      client_name: input.clientName,
      product_name: input.productName,
      material: input.material,
      color: input.color,
      status: "scheduled",
      condition: "none",
      priority: input.priority,
      is_warranty: input.isWarranty,
      entry_date: input.entryDate,
      delivery_date: input.deliveryDate,
      observations: input.observations,
      assigned_to: profileId,
      created_by: profileId,
    })
    .select("id")
    .single();
  if (orderError || !order) return { status: "error", message: orderError?.message ?? "No se pudo ingresar el producto." };

  const enabledSteps = settings.production.steps.filter((step) => step.enabled);
  const operatorByArea = new Map(
    (await listUsers())
      .filter((item) => item.active && item.role === "operator" && item.area)
      .map((item) => [item.area, item.id]),
  );
  const { error: stepsError } = await supabase.from("production_steps").insert(
    enabledSteps.map((step, index) => ({
      order_id: order.id,
      step: step.key,
      step_label: step.label,
      sort_order: index + 1,
      status: index === 0 ? "active" : "pending",
      notes: index === 0 ? `Ingresado por ${user.name}` : null,
      assigned_to: index === 0 ? profileId : operatorByArea.get(step.key) ?? profileId,
    })),
  );
  if (stepsError) {
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    return { status: "error", message: stepsError.message };
  }

  await supabase.from("audit_logs").insert({
    order_id: order.id,
    action: "create_workshop_order",
    entity: "orders",
    entity_id: order.id,
    profile_id: profileId,
    new_value: input.salesNoteNumber,
  });

  revalidatePath("/admin");
  revalidatePath("/taller");
  return { status: "success", message: "Producto ingresado al flujo de taller.", orderId: order.id };
}

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
  if (!currentStep) return { status: "error", message: "No se encontro la etapa seleccionada." };
  if (!isAllowedTransition(currentStep.status, parsed.data.status)) {
    return { status: "error", message: "La etapa cambio de estado. Actualiza la vista e intenta nuevamente." };
  }

  const settings = await getSystemSettings();
  if (
    parsed.data.status === "blocked" &&
    settings.permissions.requireBlockReason &&
    (!parsed.data.reason || parsed.data.reason.length < 5)
  ) {
    return { status: "error", message: "Describe brevemente por que se bloquea la etapa." };
  }

  if (user.role === "operator") {
    const permissions = settings.permissions;
    const allowed =
      (parsed.data.status === "active" && permissions.operatorsCanStartSteps) ||
      (parsed.data.status === "done" && permissions.operatorsCanCompleteSteps) ||
      (parsed.data.status === "blocked" && permissions.operatorsCanBlockSteps);
    if (!allowed) return { status: "error", message: "Esta accion esta deshabilitada para operarios." };
    if (!canWorkerUseStep(user, currentStep)) {
      return { status: "error", message: "Esta etapa no esta asignada a tu usuario." };
    }
  }

  if (!hasSupabaseConfig()) {
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
    revalidatePath(`/taller/orders/${parsed.data.orderId}`);

    return {
      status: "success",
      message: "Etapa actualizada.",
    };
  }

  const supabase = await createClient();
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
    updated_by: profile.id,
  };

  let updateQuery = supabase
    .from("production_steps")
    .update(patch)
    .eq("order_id", parsed.data.orderId)
    .eq("step", parsed.data.stepKey);

  if (user.role === "operator" && user.area) {
    updateQuery = updateQuery.eq("assigned_to", profile.id);
  }

  const { data: updated, error } = await updateQuery.select("id");

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
      return { status: "error", message: "La etapa se completo, pero falta configurar la clave de servicio para cerrar la orden." };
    }
    const { error: closeError } = await getSupabaseAdmin()
      .from("orders")
      .update({ status: "completed", condition: "delivered", completed_at: now })
      .eq("id", parsed.data.orderId);
    if (closeError) return { status: "error", message: `La etapa se completo, pero no se pudo cerrar la orden: ${closeError.message}` };
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    order_id: parsed.data.orderId,
    action: "update_step",
    entity: "production_steps",
    profile_id: profile.id,
    field_name: "status",
    new_value: parsed.data.reason
      ? `${parsed.data.status}: ${parsed.data.reason}`
      : parsed.data.status,
  });
  if (auditError) return { status: "error", message: `La etapa cambio, pero no se pudo registrar la auditoria: ${auditError.message}` };

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

async function getCurrentProfileId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("active", true)
    .maybeSingle();
  return profile?.id ?? null;
}
