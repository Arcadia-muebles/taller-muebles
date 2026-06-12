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
  width: z.coerce.number({ message: "Ingresa el ancho." }).int().positive("Debe ser mayor que 0."),
  depth: z.coerce.number({ message: "Ingresa la profundidad." }).int().positive("Debe ser mayor que 0."),
  height: z.coerce.number({ message: "Ingresa el alto." }).int().positive("Debe ser mayor que 0."),
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
    width: formData.get("width"),
    depth: formData.get("depth"),
    height: formData.get("height"),
    observations: formData.get("observations")?.toString() || undefined,
  });  if (!parsed.success) {
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
    width: parsed.data.width,
    depth: parsed.data.depth,
    height: parsed.data.height,
    observations: parsed.data.observations || "Ingresado desde panel de taller.",
    isWarranty: false,
  };  if (!hasSupabaseConfig()) {
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
    return { status: "error", message: storeError?.message ?? "No se encontró la empresa cliente seleccionada." };
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
      status: "in_production",
      condition: "none",
      priority: input.priority,
      is_warranty: input.isWarranty,
      entry_date: input.entryDate,
      delivery_date: input.deliveryDate,
      observations: input.observations,
      assigned_to: null,
      created_by: profileId,
      width: input.width,
      depth: input.depth,
      height: input.height,
    })
    .select("id")
    .single(); if (orderError || !order) return { status: "error", message: orderError?.message ?? "No se pudo ingresar el producto." };

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

    // Auto-deduct stock
  try {
    await deductSupabaseStockForOrder(supabase, order.id, input.salesNoteNumber, {
      material: input.material,
      width: input.width,
      depth: input.depth,
      height: input.height,
    });
  } catch (err) {
    console.error("Failed to automatically deduct stock in Supabase:", err);
  }

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
  if (!currentOrder || !currentStep) return { status: "error", message: "No se encontro la etapa seleccionada." };
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
    if (!allowed) return { status: "error", message: "Esta acción está deshabilitada para operarios." };
    if (!canWorkerUseStep(user, currentStep)) return { status: "error", message: "No puedes operar esta etapa." };
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
    blocked_reason: parsed.data.status === "blocked" ? parsed.data.reason : null,
    notes: parsed.data.reason?.trim() || (parsed.data.status === "blocked" ? parsed.data.reason : null),
    started_at: parsed.data.status === "active" ? now : undefined,
    completed_at: parsed.data.status === "done" ? now : undefined,
    updated_by: profile.id,
  };

  const updateQuery = supabase
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

  const nextStep = parsed.data.status === "done"
    ? nextPendingStep(currentOrder, parsed.data.stepKey)
    : undefined;

  if (nextStep) {
    const { error: nextError } = await supabase
      .from("production_steps")
      .update({
        status: "pending",
        started_at: null,
        blocked_reason: null,
        notes: null,
        updated_by: profile.id,
      })
      .eq("order_id", parsed.data.orderId)
      .eq("step", nextStep.key);
    if (nextError) {
      return { status: "error", message: `La etapa se completó, pero no se pudo iniciar la siguiente: ${nextError.message}` };
    }
  }

  const nextOrderStatus =
    parsed.data.status === "blocked"
      ? "blocked"
      : parsed.data.status === "done" && !nextStep
        ? "completed"
        : nextStep?.key === "quality"
          ? "quality_control"
          : currentOrder.priority === "critical"
            ? "urgent"
            : "in_production";

  await supabase
    .from("orders")
    .update({
      status: nextOrderStatus,
      condition: nextOrderStatus === "completed" ? "delivered" : undefined,
      completed_at: nextOrderStatus === "completed" ? now : undefined,
    })
    .eq("id", parsed.data.orderId);

  if (
    parsed.data.stepKey === "quality" &&
    parsed.data.status === "done" &&
    !nextStep &&
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

function nextPendingStep(order: NonNullable<Awaited<ReturnType<typeof getOrder>>>, currentStepKey: string) {
  const currentIndex = order.steps.findIndex((step) => step.key === currentStepKey);
  if (currentIndex < 0) return undefined;
  return order.steps.slice(currentIndex + 1).find((step) => step.status === "pending");
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

/* eslint-disable @typescript-eslint/no-explicit-any */
async function deductSupabaseStockForOrder(
  supabase: any,
  orderId: string,
  orderCode: string,
  input: {
    material: string;
    width: number;
    depth: number;
    height: number;
  }
) {
  const { material, width, depth, height } = input;
  const leatherQty = Math.round(((width * depth * 3 + width * height * 2 + depth * height * 2) / 10000) * 10) / 10;
  const woodQty = Math.max(2, Math.round((width * 2 + depth * 4 + height * 4) / 100));
  const foamQty = Math.max(1, Math.round((width * depth * 2) / 10000));

  const { data: materials } = await supabase.from("materials").select("*").eq("active", true);
  if (!materials) return;

  // 1. Deduct Leather
  const leatherItem = materials.find((item: any) => 
    item.category.toLowerCase() === "cuero" && 
    (item.name.toLowerCase().includes(material.toLowerCase()) || material.toLowerCase().includes(item.name.toLowerCase()))
  ) || materials.find((item: any) => item.category.toLowerCase() === "cuero");

  if (leatherItem) {
    await supabase.rpc("record_stock_movement", {
      p_material_id: leatherItem.id,
      p_movement_type: "out",
      p_quantity: leatherQty,
      p_notes: `Consumo automático orden ${orderCode} (${width}x${depth}x${height})`,
      p_order_id: orderId,
    });
  }

  // 2. Deduct Wood
  const woodItem = materials.find((item: any) => item.category.toLowerCase() === "estructura") || materials.find((item: any) => item.name.toLowerCase().includes("madera"));
  if (woodItem) {
    await supabase.rpc("record_stock_movement", {
      p_material_id: woodItem.id,
      p_movement_type: "out",
      p_quantity: woodQty,
      p_notes: `Consumo automático orden ${orderCode} (${width}x${depth}x${height})`,
      p_order_id: orderId,
    });
  }

  // 3. Deduct Foam
  const foamItem = materials.find((item: any) => item.category.toLowerCase() === "relleno") || materials.find((item: any) => item.name.toLowerCase().includes("espuma"));
  if (foamItem) {
    await supabase.rpc("record_stock_movement", {
      p_material_id: foamItem.id,
      p_movement_type: "out",
      p_quantity: foamQty,
      p_notes: `Consumo automático orden ${orderCode} (${width}x${depth}x${height})`,
      p_order_id: orderId,
    });
  }
}
