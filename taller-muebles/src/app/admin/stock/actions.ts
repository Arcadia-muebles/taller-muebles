"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { createLocalStockItem, createLocalStockMovement, deactivateLocalStockItem } from "@/lib/local-store";
import { getSystemSettings } from "@/lib/repositories/settings";
import { createClient } from "@/lib/supabase/server";

const stockSchema = z.object({
  name: z.string().trim().min(2),
  category: z.string().trim().min(2),
  unit: z.enum(["unidad", "metro", "m2", "kg", "litro", "plancha", "rollo"]),
  available: z.coerce.number().int().min(0),
  minimum: z.coerce.number().int().min(0),
  store: z.enum(["LH", "LR", "general"]),
});

const movementSchema = z.object({
  materialId: z.string().min(1),
  type: z.enum(["in", "out", "adjustment"]),
  quantity: z.coerce.number().positive(),
  notes: z.string().trim().min(3).max(300),
});

export type StockActionResult = { ok: boolean; message: string };

export async function createStockItem(formData: FormData) {
  const user = await requireSession(["admin", "manager"]);
  if (user.role === "manager" && !(await getSystemSettings()).permissions.managersCanManageStock) {
    return { ok: false, message: "Tu perfil no puede crear materiales." };
  }
  const parsed = stockSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    unit: formData.get("unit"),
    available: formData.get("available"),
    minimum: formData.get("minimum"),
    store: formData.get("store"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos del material." };
  }

  try {
    if (!hasSupabaseConfig()) {
      await createLocalStockItem(parsed.data);
    } else {
      const supabase = await createClient();
      const storeId = parsed.data.store === "general"
        ? null
        : (await supabase.from("stores").select("id").eq("code", parsed.data.store).maybeSingle()).data?.id ?? null;
      const { error } = await supabase.from("materials").insert({
        store_id: storeId,
        name: parsed.data.name,
        category: parsed.data.category,
        unit: parsed.data.unit,
        current_quantity: parsed.data.available,
        minimum_quantity: parsed.data.minimum,
      });
      if (error) return { ok: false, message: `No fue posible crear el material: ${error.message}` };
    }
  } catch (error) {
    console.error("Stock item creation failed:", error);
    return { ok: false, message: "No fue posible crear el material. Intenta nuevamente." };
  }
  revalidatePath("/admin");
  revalidatePath("/admin/stock");
  return { ok: true, message: "Material registrado correctamente." };
}

export async function removeStockItem(formData: FormData) {
  const user = await requireSession(["admin", "manager"]);
  if (user.role === "manager" && !(await getSystemSettings()).permissions.managersCanManageStock) return;
  const id = formData.get("stockItemId")?.toString();
  if (!id) return;

  if (!hasSupabaseConfig()) {
    await deactivateLocalStockItem(id);
  } else {
    const supabase = await createClient();
    await supabase.from("materials").update({ active: false }).eq("id", id);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/stock");
}

export async function adjustStockItem(formData: FormData): Promise<StockActionResult> {
  const user = await requireSession(["admin", "manager"]);
  if (user.role === "manager" && !(await getSystemSettings()).permissions.managersCanManageStock) {
    return { ok: false, message: "Tu perfil no puede registrar movimientos de stock." };
  }
  const parsed = movementSchema.safeParse({
    materialId: formData.get("materialId"),
    type: formData.get("type"),
    quantity: formData.get("quantity"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos del movimiento." };
  }

  try {
    if (!hasSupabaseConfig()) {
      const created = await createLocalStockMovement(parsed.data);
      if (!created) return { ok: false, message: "El material no existe o la salida supera el stock disponible." };
    } else {
      const supabase = await createClient();
      const { error } = await supabase.rpc("record_stock_movement", {
        p_material_id: parsed.data.materialId,
        p_movement_type: parsed.data.type,
        p_quantity: parsed.data.quantity,
        p_notes: parsed.data.notes,
      });
      if (error) return { ok: false, message: `No fue posible registrar el movimiento: ${error.message}` };
    }
  } catch (error) {
    console.error("Stock movement failed:", error);
    return { ok: false, message: "No fue posible registrar el movimiento. Intenta nuevamente." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/stock");
  return { ok: true, message: "Movimiento registrado correctamente." };
}
