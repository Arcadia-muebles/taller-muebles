"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { orderSchema, parseBooleanFormValue } from "@/lib/validation/order";

export type CreateOrderState = {
  status: "idle" | "success" | "error";
  message: string;
  orderId?: string;
};

const stepSeed = [
  { step: "structure", sort_order: 1 },
  { step: "cutting", sort_order: 2 },
  { step: "sewing", sort_order: 3 },
  { step: "upholstery", sort_order: 4 },
  { step: "quality", sort_order: 5 },
] as const;

export async function createOrder(
  _prevState: CreateOrderState,
  formData: FormData,
): Promise<CreateOrderState> {
  const parsed = orderSchema.safeParse({
    store: formData.get("store"),
    salesNoteNumber: formData.get("salesNoteNumber"),
    clientName: formData.get("clientName"),
    productName: formData.get("productName"),
    material: formData.get("material"),
    color: formData.get("color"),
    entryDate: formData.get("entryDate"),
    deliveryDate: formData.get("deliveryDate"),
    priority: formData.get("priority"),
    assignedTo: formData.get("assignedTo"),
    observations: formData.get("observations")?.toString() ?? "",
    isWarranty: parseBooleanFormValue(formData.get("isWarranty")),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: formatZodError(parsed.error),
    };
  }

  if (!hasSupabaseConfig()) {
    return {
      status: "success",
      message:
        "Modo demo: la orden fue validada. Con Supabase configurado se insertara en la base y creara sus etapas.",
    };
  }

  const supabase = await createClient();
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id")
    .eq("code", parsed.data.store)
    .single();

  if (storeError || !store) {
    return {
      status: "error",
      message: storeError?.message ?? "No se encontro la tienda seleccionada.",
    };
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      store_id: store.id,
      internal_code: parsed.data.salesNoteNumber,
      sales_note_number: parsed.data.salesNoteNumber,
      client_name: parsed.data.clientName,
      product_name: parsed.data.productName,
      material: parsed.data.material,
      color: parsed.data.color,
      status: "scheduled",
      condition: "none",
      priority: parsed.data.priority,
      is_warranty: parsed.data.isWarranty,
      entry_date: parsed.data.entryDate,
      delivery_date: parsed.data.deliveryDate,
      observations: parsed.data.observations,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return {
      status: "error",
      message: orderError?.message ?? "No se pudo crear la orden.",
    };
  }

  const { error: stepsError } = await supabase.from("production_steps").insert(
    stepSeed.map((step) => ({
      order_id: order.id,
      step: step.step,
      sort_order: step.sort_order,
      status: step.sort_order === 1 ? "active" : "pending",
      notes:
        step.sort_order === 1
          ? `Responsable inicial sugerido: ${parsed.data.assignedTo}`
          : null,
    })),
  );

  if (stepsError) {
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
    new_value: parsed.data.salesNoteNumber,
  });

  revalidatePath("/admin");
  revalidatePath("/taller");

  return {
    status: "success",
    message: "Orden creada y etapas productivas generadas.",
    orderId: order.id,
  };
}

function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join(" ");
}
