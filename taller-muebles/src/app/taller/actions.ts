"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/env";
import { createLocalOrder, nextLocalOrderCode, updateLocalProductionStep } from "@/lib/local-store";
import { nextOrderCodeForStore } from "@/lib/order-codes";
import { getOrder, listUsers } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { priorityFromDeliveryDate } from "@/lib/utils";
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
    observations: formData.get("observations")?.toString() || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los datos del producto." };
  }

  const salesNoteNumber = await nextWorkshopOrderCode(parsed.data.store);
  const entryDate = new Date().toISOString().slice(0, 10);
  const priority = priorityFromDeliveryDate(parsed.data.deliveryDate, {
    urgentDays: settings.alerts.urgentDeliveryDays,
    upcomingDays: settings.alerts.upcomingDeliveryDays,
  });
  const input = {
    store: parsed.data.store,
    documentType: "production_intake" as const,
    documentStatus: "issued" as const,
    salesNoteNumber,
    clientName: parsed.data.clientName || "Trabajo interno",
    productName: parsed.data.productName,
    material: parsed.data.material || "Por definir",
    color: parsed.data.color || "Por definir",
    entryDate,
    deliveryDate: parsed.data.deliveryDate,
    groupCode: salesNoteNumber,
    priority,
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
    return { status: "error", message: storeError?.message ?? "No se encontró la tienda seleccionada." };
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      store_id: store.id,
      internal_code: input.salesNoteNumber,
      sales_note_number: input.salesNoteNumber,
      group_code: input.groupCode,
      document_type: input.documentType,
      document_status: input.documentStatus,
      client_name: input.clientName,
      product_name: input.productName,
      material: input.material,
      color: input.color,
      status: "in_production",
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
  const operatorByArea = operatorMapByArea(await listUsers());
  const { error: stepsError } = await supabase.from("production_steps").insert(
    enabledSteps.map((step, index) => ({
      order_id: order.id,
      step: step.key,
      step_label: step.label,
      sort_order: index + 1,
      status: index === 0 ? "active" : "pending",
      started_at: index === 0 ? new Date().toISOString() : null,
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
      message: "Acción de producción inválida.",
    };
  }

  const currentOrder = await getOrder(parsed.data.orderId);
  const currentStep = currentOrder?.steps.find((step) => step.key === parsed.data.stepKey);
  if (!currentOrder || !currentStep) return { status: "error", message: "No se encontró la etapa seleccionada." };
  if (!isAllowedTransition(currentStep.status, parsed.data.status)) {
    return { status: "error", message: "La etapa cambió de estado. Actualiza la vista e intenta nuevamente." };
  }

  const currentStepIndex = currentOrder.steps.findIndex((step) => step.key === parsed.data.stepKey);
  const previousSteps = currentOrder.steps.slice(0, currentStepIndex);
  const laterSteps = currentOrder.steps.slice(currentStepIndex + 1);
  const isReversal = isReverseTransition(currentStep.status, parsed.data.status);

  const settings = await getSystemSettings();
  const enteringPendingStep =
    currentStep.status === "pending" &&
    (parsed.data.status === "active" || parsed.data.status === "blocked");
  if (
    !settings.production.allowParallelSteps &&
    enteringPendingStep &&
    previousSteps.some((step) => step.status !== "done")
  ) {
    return { status: "error", message: "Termina las etapas anteriores antes de operar esta etapa." };
  }
  if (
    !settings.production.allowParallelSteps &&
    parsed.data.status === "active" &&
    !isReversal &&
    currentOrder.steps.some((step) => step.key !== currentStep.key && step.status === "active")
  ) {
    return { status: "error", message: "Ya existe otra etapa activa en esta orden." };
  }
  if (
    parsed.data.status === "blocked" &&
    settings.permissions.requireBlockReason &&
    (!parsed.data.reason || parsed.data.reason.length < 5)
  ) {
    return { status: "error", message: "Describe brevemente por qué se bloquea la etapa." };
  }

  if (user.role === "operator") {
    const permissions = settings.permissions;
    const allowed = isOperatorTransitionAllowed(currentStep.status, parsed.data.status, permissions);
    if (!allowed) return { status: "error", message: "Esta acción está deshabilitada para operarios." };
    if (!canWorkerUseStep(user, currentStep)) return { status: "error", message: "No puedes operar esta etapa." };
    if (isReversal && laterSteps.some(hasRecordedWork)) {
      return {
        status: "error",
        message: "Una etapa posterior ya tiene actividad. Pide a un administrador que haga la corrección.",
      };
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
        message: "No se encontró la etapa seleccionada.",
      };
    }

    revalidatePath("/admin");
    revalidatePath("/taller");
    revalidatePath(`/admin/orders/${parsed.data.orderId}`);
    revalidatePath(`/taller/orders/${parsed.data.orderId}`);

    return {
      status: "success",
      message: isReversal ? "Cambio revertido y tiempos corregidos." : "Etapa actualizada.",
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
  if (user.role === "operator" && !hasSupabaseAdminConfig()) {
    return { status: "error", message: "Falta configurar el servicio seguro para actualizar el estado de la orden." };
  }
  const mutationClient = user.role === "operator" ? getSupabaseAdmin() : supabase;

  const patch = stepPatch({
    currentStep,
    nextStatus: parsed.data.status,
    reason: parsed.data.reason,
    now,
    profileId: profile.id,
  });

  const updateQuery = mutationClient
    .from("production_steps")
    .update(patch)
    .eq("order_id", parsed.data.orderId)
    .eq("step", parsed.data.stepKey);

  const { data: updated, error } = await updateQuery.select("id");

  if (error || !updated?.length) {
    return {
      status: "error",
      message: error?.message ?? "La etapa no pudo actualizarse con los permisos actuales.",
    };
  }

  if (isReversal && laterSteps.some(hasRecordedWork)) {
    const { error: downstreamError } = await mutationClient
      .from("production_steps")
      .update({
        status: "pending",
        started_at: null,
        completed_at: null,
        blocked_reason: null,
        updated_by: profile.id,
      })
      .eq("order_id", parsed.data.orderId)
      .in("step", laterSteps.map((step) => step.key));
    if (downstreamError) {
      return {
        status: "error",
        message: `La etapa cambió, pero no se pudieron corregir las etapas posteriores: ${downstreamError.message}`,
      };
    }
  }

  const effectiveSteps = currentOrder.steps.map((step, index) => {
    if (step.key === parsed.data.stepKey) return { ...step, status: parsed.data.status };
    if (isReversal && index > currentStepIndex) {
      return { ...step, status: "pending" as const, startedAt: undefined, completedAt: undefined };
    }
    return step;
  });
  const nextOrderStatus = orderStatusAfterStepChange(
    currentOrder.priority,
    effectiveSteps,
    settings.production.autoCompleteAfterQuality,
  );
  const { error: orderStatusError } = await mutationClient
    .from("orders")
    .update({
      status: nextOrderStatus,
      condition: nextOrderStatus === "completed"
        ? "delivered"
        : nextOrderStatus === "quality_control"
          ? "quality_control"
          : "none",
      completed_at: nextOrderStatus === "completed" ? now : null,
    })
    .eq("id", parsed.data.orderId);
  if (orderStatusError) {
    return {
      status: "error",
      message: `La etapa cambió, pero no se pudo actualizar el estado de la orden: ${orderStatusError.message}`,
    };
  }

  const { error: auditError } = await mutationClient.from("audit_logs").insert({
    order_id: parsed.data.orderId,
    action: isReversal ? "revert_step" : "update_step",
    entity: "production_steps",
    profile_id: profile.id,
    field_name: "status",
    old_value: currentStep.status,
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
    message: isReversal ? "Cambio revertido y tiempos corregidos." : "Etapa actualizada.",
  };
}

function isAllowedTransition(current: UpdateStepInput["status"], next: UpdateStepInput["status"]) {
  if (current === "pending") return next === "active" || next === "blocked";
  if (current === "active") return next === "done" || next === "blocked" || next === "pending";
  if (current === "blocked") return next === "active" || next === "pending";
  return current === "done" && next === "active";
}

function isReverseTransition(current: UpdateStepInput["status"], next: UpdateStepInput["status"]) {
  return (
    (current === "active" && next === "pending") ||
    (current === "done" && next === "active") ||
    (current === "blocked" && next === "pending")
  );
}

function isOperatorTransitionAllowed(
  current: UpdateStepInput["status"],
  next: UpdateStepInput["status"],
  permissions: Awaited<ReturnType<typeof getSystemSettings>>["permissions"],
) {
  if (current === "active" && next === "pending") return permissions.operatorsCanStartSteps;
  if (current === "done" && next === "active") return permissions.operatorsCanCompleteSteps;
  if (current === "blocked" && next === "pending") return permissions.operatorsCanBlockSteps;
  if (next === "active") return permissions.operatorsCanStartSteps;
  if (next === "done") return permissions.operatorsCanCompleteSteps;
  if (next === "blocked") return permissions.operatorsCanBlockSteps;
  return false;
}

function hasRecordedWork(step: NonNullable<Awaited<ReturnType<typeof getOrder>>>["steps"][number]) {
  return step.status !== "pending" || Boolean(step.startedAt || step.completedAt);
}

function stepPatch({
  currentStep,
  nextStatus,
  reason,
  now,
  profileId,
}: {
  currentStep: NonNullable<Awaited<ReturnType<typeof getOrder>>>["steps"][number];
  nextStatus: UpdateStepInput["status"];
  reason?: string;
  now: string;
  profileId: string;
}) {
  return {
    status: nextStatus,
    blocked_reason: nextStatus === "blocked" ? reason?.trim() || null : null,
    notes: reason?.trim() || currentStep.notes || null,
    started_at:
      nextStatus === "pending"
        ? null
        : nextStatus === "active" || nextStatus === "done"
          ? currentStep.startedAt ?? now
          : currentStep.startedAt ?? null,
    completed_at: nextStatus === "done" ? now : null,
    updated_by: profileId,
  };
}

function orderStatusAfterStepChange(
  priority: NonNullable<Awaited<ReturnType<typeof getOrder>>>["priority"],
  steps: NonNullable<Awaited<ReturnType<typeof getOrder>>>["steps"],
  autoCompleteAfterQuality: boolean,
) {
  if (steps.some((step) => step.status === "blocked")) return "blocked" as const;
  if (steps.every((step) => step.status === "done")) {
    if (steps.at(-1)?.key === "quality" && !autoCompleteAfterQuality) return "quality_control" as const;
    return "completed" as const;
  }
  if (steps.find((step) => step.key === "quality")?.status === "active") return "quality_control" as const;
  return priority === "critical" ? "urgent" as const : "in_production" as const;
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

function operatorMapByArea(users: Awaited<ReturnType<typeof listUsers>>) {
  const map = new Map<string, string>();
  for (const user of users) {
    if (!user.active || user.role !== "operator") continue;
    const areas = user.areas?.length ? user.areas : user.area ? [user.area] : [];
    for (const area of areas) {
      if (!map.has(area)) map.set(area, user.id);
    }
  }
  return map;
}

async function nextWorkshopOrderCode(store: z.infer<typeof workshopOrderSchema>["store"]) {
  if (!hasSupabaseConfig()) return nextLocalOrderCode(store);
  return nextOrderCodeForStore(store, await getOrderCodes());
}

async function getOrderCodes() {
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("internal_code");
  return data?.map((order) => order.internal_code) ?? [];
}
