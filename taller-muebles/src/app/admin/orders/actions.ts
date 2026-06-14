"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { cancelLocalOrder, closeLocalOrder, createLocalOrder, createLocalOrderAttachment, createLocalStockMovement, moveLocalOrderToStep, updateLocalOrder } from "@/lib/local-store";
import { createClient } from "@/lib/supabase/server";
import { listOrders, listStockItems, listUsers } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import { orderSchema, parseBooleanFormValue } from "@/lib/validation/order";

export type CreateOrderState = {
  status: "idle" | "success" | "error";
  message: string;
  orderId?: string;
};

export type MoveOrderStageResult = {
  ok: boolean;
  message: string;
};

const maxAttachmentSize = 10 * 1024 * 1024;

type ConsumptionLine = {
  materialId: string;
  quantity: number;
  notes?: string;
};

const consumptionLineSchema = z.object({
  materialId: z.string().trim().min(1),
  quantity: z.coerce.number().positive("Ingresa una cantidad mayor que 0."),
  notes: z.string().trim().max(300).optional(),
});

export async function createOrder(
  _prevState: CreateOrderState,
  formData: FormData,
): Promise<CreateOrderState> {
  const user = await requireSession(["admin", "manager"]);
  const settings = await getSystemSettings();
  if (user.role === "manager" && !settings.permissions.managersCanEditOrders) {
    return { status: "error", message: "Tu perfil no tiene permiso para crear órdenes." };
  }
    const parsed = orderSchema.safeParse({
    store: formData.get("store"),
    salesNoteNumber: formData.get("salesNoteNumber"),
    productName: formData.get("productName"),
    material: formData.get("material"),
    color: formData.get("color"),
    entryDate: formData.get("entryDate"),
    deliveryDate: formData.get("deliveryDate"),
    priority: formData.get("priority"),
    width: formData.get("width"),
    depth: formData.get("depth"),
    height: formData.get("height"),
    observations: formData.get("observations")?.toString() ?? "",
    isWarranty: parseBooleanFormValue(formData.get("isWarranty")),
  });  if (!parsed.success) {
    return {
      status: "error",
      message: formatZodError(parsed.error),
    };
  }
  const ruleError = await validateOrderRules(parsed.data, settings);
  if (ruleError) return { status: "error", message: ruleError };

  const consumption = parseConsumptionLines(formData);
  if (!consumption.ok) return { status: "error", message: consumption.message };
  const stockError = await validateConsumptionAvailability(consumption.lines);
  if (stockError) return { status: "error", message: stockError };

  if (!hasSupabaseConfig()) {
    const order = await createLocalOrder({
      ...parsed.data,
      clientName: clientNameFromStore(parsed.data.store),
      steps: settings.production.steps,
    });
    const consumptionError = await applyLocalOrderConsumption(order.id, order.code, consumption.lines);
    if (consumptionError) return { status: "error", message: consumptionError, orderId: order.id };
    const attachmentResult = await saveInitialAttachment({
      formData,
      orderId: order.id,
      profileId: null,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/stock");
    revalidatePath("/taller");
    revalidatePath(`/admin/orders/${order.id}`);

    return {
      status: "success",
      message: [
        "Orden creada en almacenamiento local.",
        consumption.lines.length ? "Stock descontado." : "",
        attachmentResult.message,
      ].filter(Boolean).join(" "),
      orderId: order.id,
    };
  }

  const supabase = await createClient();
  const profileId = await getCurrentProfileId(supabase);
  if (!profileId) return { status: "error", message: "No se pudo identificar tu perfil." };
    const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id")
    .eq("code", parsed.data.store)
    .single();

  if (storeError || !store) {
    return {
      status: "error",
      message: storeError?.message ?? "No se encontró la empresa cliente seleccionada.",
    };
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      store_id: store.id,
      internal_code: parsed.data.salesNoteNumber,
      sales_note_number: parsed.data.salesNoteNumber,
      client_name: clientNameFromStore(parsed.data.store),
      product_name: parsed.data.productName,
      material: parsed.data.material,
      color: parsed.data.color,
      status: "in_production",
      condition: "none",
      priority: parsed.data.priority,
      is_warranty: parsed.data.isWarranty,
      entry_date: parsed.data.entryDate,
      delivery_date: parsed.data.deliveryDate ?? null,
      observations: parsed.data.observations,
      assigned_to: null,
      created_by: profileId,
      width: parsed.data.width,
      depth: parsed.data.depth,
      height: parsed.data.height,
    })
    .select("id")
    .single();  if (orderError || !order) {
    return {
      status: "error",
      message: orderError?.message ?? "No se pudo crear la orden.",
    };
  }

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
      notes: null,
      assigned_to: operatorByArea.get(step.key) ?? null,
    })),
  );  if (stepsError) {
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    return {
      status: "error",
      message: stepsError.message,
    };
  }

  await supabase.from("audit_logs").insert({
    order_id: order.id,
    action: "create_order",
    entity: "orders",
    entity_id: order.id,
    profile_id: profileId,
    new_value: parsed.data.salesNoteNumber,
  });

  const attachmentResult = await saveInitialAttachment({
    formData,
    orderId: order.id,
    profileId,
    supabase,
  });

  const consumptionError = await applySupabaseOrderConsumption(supabase, order.id, parsed.data.salesNoteNumber, consumption.lines);
  if (consumptionError) return { status: "error", message: consumptionError, orderId: order.id };

  revalidatePath("/admin");
  revalidatePath("/admin/stock");
  revalidatePath("/taller");
  revalidatePath(`/admin/orders/${order.id}`);

  return {
    status: "success",
    message: [
      "Orden creada y etapas productivas generadas.",
      consumption.lines.length ? "Stock descontado." : "",
      attachmentResult.message,
    ].filter(Boolean).join(" "),
    orderId: order.id,
  };
}

export async function updateOrder(
  orderId: string,
  _prevState: CreateOrderState,
  formData: FormData,
): Promise<CreateOrderState> {
  const user = await requireSession(["admin", "manager"]);
  const settings = await getSystemSettings();
  if (user.role === "manager" && !settings.permissions.managersCanEditOrders) {
    return { status: "error", message: "Tu perfil no tiene permiso para editar órdenes." };
  }
    const parsed = orderSchema.safeParse({
    store: formData.get("store"),
    salesNoteNumber: formData.get("salesNoteNumber"),
    productName: formData.get("productName"),
    material: formData.get("material"),
    color: formData.get("color"),
    entryDate: formData.get("entryDate"),
    deliveryDate: formData.get("deliveryDate"),
    priority: formData.get("priority"),
    width: formData.get("width"),
    depth: formData.get("depth"),
    height: formData.get("height"),
    observations: formData.get("observations")?.toString() ?? "",
    isWarranty: parseBooleanFormValue(formData.get("isWarranty")),
  }); if (!parsed.success) return { status: "error", message: formatZodError(parsed.error) };
  const ruleError = await validateOrderRules(parsed.data, settings, orderId);
  if (ruleError) return { status: "error", message: ruleError };

  if (!hasSupabaseConfig()) {
    const updated = await updateLocalOrder(orderId, {
      ...parsed.data,
      clientName: clientNameFromStore(parsed.data.store),
    });
    if (!updated) return { status: "error", message: "No se encontró la orden." };
  } else {
        const supabase = await createClient();
    const profileId = await getCurrentProfileId(supabase);
    if (!profileId) return { status: "error", message: "No se pudo identificar tu perfil." };
    const { data: store } = await supabase.from("stores").select("id").eq("code", parsed.data.store).maybeSingle();
    if (!store) return { status: "error", message: "No se encontró la empresa cliente." };
    const { error } = await supabase.from("orders").update({
      store_id: store.id,
      internal_code: parsed.data.salesNoteNumber,
      sales_note_number: parsed.data.salesNoteNumber,
      client_name: clientNameFromStore(parsed.data.store),
      product_name: parsed.data.productName,
      material: parsed.data.material,
      color: parsed.data.color,
      priority: parsed.data.priority,
      is_warranty: parsed.data.isWarranty,
      entry_date: parsed.data.entryDate,
      delivery_date: parsed.data.deliveryDate ?? null,
      observations: parsed.data.observations,
      width: parsed.data.width,
      depth: parsed.data.depth,
      height: parsed.data.height,
    }).eq("id", orderId); if (error) return { status: "error", message: error.message };
    await supabase.from("audit_logs").insert({
      order_id: orderId,
      action: "update_order",
      entity: "orders",
      entity_id: orderId,
      profile_id: profileId,
      new_value: parsed.data.salesNoteNumber,
    });
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/admin/orders/${orderId}/edit`);
  revalidatePath("/taller");
  return { status: "success", message: "Cambios guardados correctamente.", orderId };
}

export async function cancelOrder(formData: FormData) {
  const user = await requireSession(["admin", "manager"]);
  if (user.role === "manager" && !(await getSystemSettings()).permissions.managersCanEditOrders) return;
  const id = formData.get("orderId")?.toString();
  if (!id) return;

  if (!hasSupabaseConfig()) {
    await cancelLocalOrder(id);
  } else {
    const supabase = await createClient();
    const profileId = await getCurrentProfileId(supabase);
    if (!profileId) return;
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", id);
    await supabase.from("audit_logs").insert({
      order_id: id,
      action: "cancel_order",
      entity: "orders",
      entity_id: id,
      profile_id: profileId,
      field_name: "status",
      new_value: "cancelled",
    });
  }

  revalidatePath("/admin");
  revalidatePath("/taller");
  redirect("/admin");
}

export async function closeOrder(formData: FormData) {
  const user = await requireSession(["admin", "manager"]);
  const settings = await getSystemSettings();
  if (user.role === "manager" && !settings.permissions.managersCanEditOrders) return;
  const id = formData.get("orderId")?.toString();
  if (!id) return;

  if (!hasSupabaseConfig()) {
    const { getLocalOrder } = await import("@/lib/local-store");
    const order = await getLocalOrder(id);
    if (!order?.steps.every((step) => step.status === "done")) return;
    await closeLocalOrder(id);
  } else {
    const supabase = await createClient();
    const profileId = await getCurrentProfileId(supabase);
    if (!profileId) return;
    const { data: steps } = await supabase
      .from("production_steps")
      .select("status")
      .eq("order_id", id);
    if (!steps?.length || steps.some((step) => step.status !== "done")) return;
    await supabase
      .from("orders")
      .update({ status: "completed", condition: "delivered" })
      .eq("id", id);
    await supabase
      .from("production_steps")
      .update({ status: "done", completed_at: new Date().toISOString(), updated_by: profileId })
      .eq("order_id", id);
    await supabase.from("audit_logs").insert({
      order_id: id,
      action: "close_order",
      entity: "orders",
      entity_id: id,
      profile_id: profileId,
      field_name: "status",
      new_value: "completed",
    });
  }

  revalidatePath("/admin");
  revalidatePath("/taller");
  revalidatePath(`/admin/orders/${id}`);
}

const moveOrderStageSchema = z.object({
  orderId: z.string().min(1),
  stepKey: z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/),
});

export async function moveOrderStage(input: z.infer<typeof moveOrderStageSchema>): Promise<MoveOrderStageResult> {
  const user = await requireSession(["admin", "manager"]);
  const settings = await getSystemSettings();
  if (user.role === "manager" && !settings.permissions.managersCanEditOrders) {
    return { ok: false, message: "Tu perfil no tiene permiso para mover ordenes." };
  }

  const parsed = moveOrderStageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Movimiento invalido." };

  const order = (await listOrders()).find((item) => item.id === parsed.data.orderId);
  if (!order) return { ok: false, message: "No se encontro la orden." };
  const targetIndex = order.steps.findIndex((step) => step.key === parsed.data.stepKey);
  if (targetIndex < 0) return { ok: false, message: "La etapa destino no existe en esta orden." };

  if (!hasSupabaseConfig()) {
    const moved = await moveLocalOrderToStep({
      orderId: parsed.data.orderId,
      stepKey: parsed.data.stepKey,
      actorName: user.name,
    });
    if (!moved) return { ok: false, message: "No fue posible mover la orden." };
  } else {
    const supabase = await createClient();
    const profileId = await getCurrentProfileId(supabase);
    if (!profileId) return { ok: false, message: "No se pudo identificar tu perfil." };
    const now = new Date().toISOString();

    for (const [index, step] of order.steps.entries()) {
      const patch =
        index < targetIndex
          ? {
              status: "done" as const,
              completed_at: step.completedAt ?? now,
              updated_by: profileId,
            }
          : index === targetIndex
            ? {
                status: "active" as const,
                started_at: now,
                completed_at: null,
                blocked_reason: null,
                notes: null,
                updated_by: profileId,
              }
            : {
                status: "pending" as const,
                started_at: null,
                completed_at: null,
                blocked_reason: null,
                notes: null,
                updated_by: profileId,
              };

      const { error } = await supabase
        .from("production_steps")
        .update(patch)
        .eq("order_id", parsed.data.orderId)
        .eq("step", step.key);
      if (error) return { ok: false, message: error.message };
    }

    const nextStatus =
      parsed.data.stepKey === "quality"
        ? "quality_control"
        : order.priority === "critical"
          ? "urgent"
          : "in_production";
    await supabase
      .from("orders")
      .update({
        status: nextStatus,
        condition: parsed.data.stepKey === "quality" ? "quality_control" : undefined,
      })
      .eq("id", parsed.data.orderId);

    await supabase.from("audit_logs").insert({
      order_id: parsed.data.orderId,
      action: "move_step",
      entity: "production_steps",
      entity_id: parsed.data.orderId,
      profile_id: profileId,
      field_name: "step",
      new_value: parsed.data.stepKey,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/taller");
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  return { ok: true, message: "Orden movida." };
}

function parseConsumptionLines(formData: FormData): { ok: true; lines: ConsumptionLine[] } | { ok: false; message: string } {
  const materialIds = formData.getAll("consumptionMaterialId").map((value) => value.toString().trim());
  const quantities = formData.getAll("consumptionQuantity").map((value) => value.toString().trim());
  const notes = formData.getAll("consumptionNotes").map((value) => value.toString().trim());
  const lines: ConsumptionLine[] = [];

  for (let index = 0; index < Math.max(materialIds.length, quantities.length, notes.length); index += 1) {
    const materialId = materialIds[index] ?? "";
    const quantity = quantities[index] ?? "";
    const note = notes[index] ?? "";
    if (!materialId && !quantity && !note) continue;
    if (!materialId && !quantity) continue;

    const parsed = consumptionLineSchema.safeParse({
      materialId,
      quantity,
      notes: note || undefined,
    });
    if (!parsed.success) {
      return { ok: false, message: `Revisa el material a descontar en la linea ${index + 1}. ${formatZodError(parsed.error)}` };
    }
    lines.push(parsed.data);
  }

  return { ok: true, lines };
}

async function validateConsumptionAvailability(lines: ConsumptionLine[]) {
  if (!lines.length) return null;
  const stockItems = await listStockItems();
  const stockById = new Map(stockItems.map((item) => [item.id, item]));
  const totals = new Map<string, number>();

  for (const line of lines) {
    totals.set(line.materialId, (totals.get(line.materialId) ?? 0) + line.quantity);
  }

  for (const [materialId, quantity] of totals.entries()) {
    const item = stockById.get(materialId);
    if (!item) return "Uno de los materiales a descontar ya no existe o no esta activo.";
    if (quantity > item.available) {
      return `Stock insuficiente para ${item.name}. Disponible: ${item.available} ${item.unit}. Requerido: ${quantity} ${item.unit}.`;
    }
  }

  return null;
}

async function applyLocalOrderConsumption(orderId: string, orderCode: string, lines: ConsumptionLine[]) {
  for (const line of lines) {
    const ok = await createLocalStockMovement({
      materialId: line.materialId,
      type: "out",
      quantity: line.quantity,
      notes: consumptionNote(orderCode, line),
      orderId,
    });
    if (!ok) return "La orden se creo, pero no fue posible descontar uno de los materiales.";
  }
  return null;
}

async function applySupabaseOrderConsumption(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  orderCode: string,
  lines: ConsumptionLine[],
) {
  for (const line of lines) {
    const { error } = await supabase.rpc("record_stock_movement", {
      p_material_id: line.materialId,
      p_movement_type: "out",
      p_quantity: line.quantity,
      p_notes: consumptionNote(orderCode, line),
      p_order_id: orderId,
    });
    if (error) return `La orden se creo, pero no fue posible descontar stock: ${error.message}`;
  }
  return null;
}

function consumptionNote(orderCode: string, line: ConsumptionLine) {
  return [`Consumo orden ${orderCode}`, line.notes].filter(Boolean).join(" - ");
}

function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join(" ");
}

function clientNameFromStore(store: z.infer<typeof orderSchema>["store"]) {
  return store === "LH" ? "Leather House" : "La Reina";
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

async function saveInitialAttachment({
  formData,
  orderId,
  profileId,
  supabase,
}: {
  formData: FormData;
  orderId: string;
  profileId: string | null;
  supabase?: Awaited<ReturnType<typeof createClient>>;
}) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: "" };
  if (file.size > maxAttachmentSize) {
    return { message: "El adjunto no se subió porque supera el máximo de 10 MB." };
  }

  try {
    if (!supabase) {
      await createLocalOrderAttachment(orderId, file);
      return { message: "Adjunto inicial guardado." };
    }

    const storagePath = `${orderId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: uploadError } = await supabase.storage.from("order-attachments").upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
    });
    if (uploadError) {
      return { message: "La orden quedo creada, pero no fue posible subir el adjunto." };
    }

    const { error: metadataError } = await supabase.from("order_attachments").insert({
      order_id: orderId,
      file_name: file.name,
      file_type: file.type || "application/octet-stream",
      file_size_bytes: file.size,
      storage_path: storagePath,
      uploaded_by: profileId,
    });
    if (metadataError) {
      await supabase.storage.from("order-attachments").remove([storagePath]);
      return { message: "La orden quedo creada, pero no se pudo registrar el adjunto." };
    }

    return { message: "Adjunto inicial guardado." };
  } catch {
    return { message: "La orden quedo creada, pero no fue posible subir el adjunto." };
  }
}

async function validateOrderRules(
  input: z.infer<typeof orderSchema>,
  settings: Awaited<ReturnType<typeof getSystemSettings>>,
  currentOrderId?: string,
) {
  if (input.deliveryDate && !settings.orders.allowPastDeliveryDates && input.deliveryDate < new Date().toISOString().slice(0, 10)) {
    return "La fecha de entrega no puede estar en el pasado.";
  }
  if (settings.orders.requireObservationsForWarranty && input.isWarranty && !input.observations?.trim()) {
    return "Las órdenes de garantía requieren observaciones.";
  }
  if (settings.orders.enforceUniqueSalesNote) {
    const duplicate = (await listOrders()).some(
      (order) => order.id !== currentOrderId && order.store === input.store && order.code === input.salesNoteNumber,
    );
    if (duplicate) return "Ya existe una orden con esta nota de venta para la empresa seleccionada.";
  }
  return null;
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
