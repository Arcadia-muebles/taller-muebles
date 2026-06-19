"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { createLocalOrderAttachment, createLocalOrderComment } from "@/lib/local-store";
import { getOrder } from "@/lib/repositories/production";
import { createClient } from "@/lib/supabase/server";

const maxAttachmentSize = 10 * 1024 * 1024;

const commentSchema = z.object({
  orderId: z.string().min(1),
  body: z.string().trim().min(2).max(1000),
  stepKey: z.string().trim().max(40).optional(),
  stepLabel: z.string().trim().max(80).optional(),
});

export type CollaborationActionResult = {
  ok: boolean;
  message: string;
};

export async function addOrderComment(formData: FormData) {
  const user = await requireSession(["admin", "manager", "viewer", "operator"]);
  const parsed = commentSchema.safeParse({
    orderId: formData.get("orderId"),
    body: formData.get("body"),
    stepKey: formData.get("stepKey")?.toString() || undefined,
    stepLabel: formData.get("stepLabel")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: "Escribe un comentario de al menos 2 caracteres." };
  }
  const order = await getOrder(parsed.data.orderId);
  if (!order) return { ok: false, message: "No se encontro la orden." };
  const commentStep = parsed.data.stepKey
    ? order.steps.find((step) => step.key === parsed.data.stepKey)
    : undefined;
  const stepKey = commentStep?.key;
  const stepLabel = commentStep?.label;

  if (!hasSupabaseConfig()) {
    await createLocalOrderComment({
      orderId: parsed.data.orderId,
      author: user.name,
      body: parsed.data.body,
      stepKey,
      stepLabel,
    });
  } else {
    const supabase = await createClient();
    const profileId = await getCurrentProfileId(supabase);
    if (!profileId) return { ok: false, message: "No se pudo identificar tu perfil." };

    const { error } = await supabase.from("order_comments").insert({
      order_id: parsed.data.orderId,
      profile_id: profileId,
      body: parsed.data.body,
      step_key: stepKey,
      step_label: stepLabel,
    });
    if (error) return { ok: false, message: "No fue posible publicar el comentario." };

    await supabase.from("audit_logs").insert({
      order_id: parsed.data.orderId,
      action: "add_comment",
      entity: "order_comments",
      profile_id: profileId,
      field_name: stepLabel ?? null,
      new_value: parsed.data.body.slice(0, 180),
    });
  }

  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  revalidatePath(`/taller/orders/${parsed.data.orderId}`);
  revalidatePath("/admin");
  revalidatePath("/taller");
  return { ok: true, message: "Comentario publicado." };
}

export async function uploadOrderAttachment(formData: FormData) {
  await requireSession(["admin", "manager", "operator"]);
  const orderId = formData.get("orderId")?.toString();
  const file = formData.get("file");
  if (!orderId || !(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Selecciona un archivo para subir." };
  }
  if (file.size > maxAttachmentSize) {
    return { ok: false, message: "El archivo supera el máximo de 10 MB." };
  }

  if (!hasSupabaseConfig()) {
    await createLocalOrderAttachment(orderId, file);
  } else {
    const supabase = await createClient();
    const profileId = await getCurrentProfileId(supabase);
    if (!profileId) return { ok: false, message: "No se pudo identificar tu perfil." };

    const storagePath = `${orderId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: uploadError } = await supabase.storage.from("order-attachments").upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
    });
    if (uploadError) return { ok: false, message: "No fue posible subir el archivo." };

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
      return { ok: false, message: "El archivo subió, pero no se pudo guardar su registro." };
    }

    await supabase.from("audit_logs").insert({
      order_id: orderId,
      action: "add_attachment",
      entity: "order_attachments",
      profile_id: profileId,
      new_value: file.name,
    });
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/taller/orders/${orderId}`);
  revalidatePath("/taller");
  return { ok: true, message: "Archivo adjuntado." };
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
