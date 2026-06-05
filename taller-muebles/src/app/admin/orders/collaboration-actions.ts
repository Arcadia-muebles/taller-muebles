"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { createLocalOrderAttachment, createLocalOrderComment } from "@/lib/local-store";
import { createClient } from "@/lib/supabase/server";

const commentSchema = z.object({
  orderId: z.string().min(1),
  body: z.string().trim().min(2).max(1000),
});

export async function addOrderComment(formData: FormData) {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const parsed = commentSchema.safeParse({
    orderId: formData.get("orderId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return;

  if (!hasSupabaseConfig()) {
    await createLocalOrderComment(parsed.data.orderId, user.name, parsed.data.body);
  } else {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", auth.user?.id ?? "").maybeSingle();
    await supabase.from("order_comments").insert({
      order_id: parsed.data.orderId,
      profile_id: profile?.id ?? null,
      body: parsed.data.body,
    });
  }
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
}

export async function uploadOrderAttachment(formData: FormData) {
  await requireSession(["admin", "manager"]);
  const orderId = formData.get("orderId")?.toString();
  const file = formData.get("file");
  if (!orderId || !(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024) return;

  if (!hasSupabaseConfig()) {
    await createLocalOrderAttachment(orderId, file);
  } else {
    const supabase = await createClient();
    const storagePath = `${orderId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("order-attachments").upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
    });
    if (error) return;
    const { data: auth } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", auth.user?.id ?? "").maybeSingle();
    const { error: metadataError } = await supabase.from("order_attachments").insert({
      order_id: orderId,
      file_name: file.name,
      file_type: file.type || "application/octet-stream",
      file_size_bytes: file.size,
      storage_path: storagePath,
      uploaded_by: profile?.id ?? null,
    });
    if (metadataError) await supabase.storage.from("order-attachments").remove([storagePath]);
  }
  revalidatePath(`/admin/orders/${orderId}`);
}
