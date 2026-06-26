"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { deactivateLocalSupplier, upsertLocalSupplier } from "@/lib/local-store";
import { createClient } from "@/lib/supabase/server";

type LooseDb<T> = {
  from: (table: string) => LooseQuery<T>;
};
type LooseQuery<T> = {
  update: (payload: Record<string, unknown>) => LooseQuery<T>;
  insert: (payload: Record<string, unknown>) => Promise<{ data: T[] | null; error: { message: string } | null }>;
  eq: (column: string, value: string) => Promise<{ data: T[] | null; error: { message: string } | null }>;
};
type SupplierRow = { id: string };

const supplierSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(60).optional(),
  email: z.string().trim().email().or(z.literal("")).optional(),
  address: z.string().trim().max(180).optional(),
  products: z.string().trim().min(2).max(500),
  observations: z.string().trim().max(800).optional(),
});

export async function saveSupplier(formData: FormData) {
  await requireSession(["admin", "manager"]);
  const parsed = supplierSchema.safeParse({
    id: formData.get("id")?.toString() || undefined,
    name: formData.get("name"),
    contactName: formData.get("contactName")?.toString() || undefined,
    phone: formData.get("phone")?.toString() || undefined,
    email: formData.get("email")?.toString() || undefined,
    address: formData.get("address")?.toString() || undefined,
    products: formData.get("products"),
    observations: formData.get("observations")?.toString() || undefined,
  });
  if (!parsed.success) return;

  if (!hasSupabaseConfig()) {
    await upsertLocalSupplier(parsed.data);
  } else {
    const supabase = await createClient();
    const payload = {
      name: parsed.data.name,
      contact_name: parsed.data.contactName || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      products: parsed.data.products,
      observations: parsed.data.observations || null,
      active: true,
      updated_at: new Date().toISOString(),
    };
    const supplierDb = supabase as unknown as LooseDb<SupplierRow>;
    if (parsed.data.id) {
      await supplierDb.from("suppliers").update(payload).eq("id", parsed.data.id);
    } else {
      await supplierDb.from("suppliers").insert(payload);
    }
  }

  revalidatePath("/admin/suppliers");
}

export async function deactivateSupplier(formData: FormData) {
  await requireSession(["admin", "manager"]);
  const id = formData.get("id")?.toString();
  if (!id) return;

  if (!hasSupabaseConfig()) {
    await deactivateLocalSupplier(id);
  } else {
    const supabase = await createClient();
    await (supabase as unknown as LooseDb<SupplierRow>).from("suppliers").update({ active: false, updated_at: new Date().toISOString() }).eq("id", id);
  }

  revalidatePath("/admin/suppliers");
}
