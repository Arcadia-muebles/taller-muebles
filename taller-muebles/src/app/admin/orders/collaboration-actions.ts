"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { createLocalOrderAttachment, createLocalOrderComment } from "@/lib/local-store";
import { getOrder } from "@/lib/repositories/production";
import { createClient } from "@/lib/supabase/server";
import { canWorkerSeeOrder } from "@/lib/workshop-access";

const maxAttachmentSize = 10 * 1024 * 1024;

const commentSchema = z.object({
  orderId: z.string().min(1),
  body: z.string().trim().min(2).max(1000),
});

export type CollaborationActionResult = {
  ok: boolean;
  message: string;
};

export async function addOrderComment(formData: FormData) {
  const user = await requireSession(["admin", "manager", "operator"]);
  const parsed = commentSchema.safeParse({
    orderId: formData.get("orderId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Escribe un comentario de al menos 2 caracteres." };
  }
  if (!(await canAccessOrder(user, parsed.data.orderId))) {
    return { ok: false, message: "No tienes acceso a esta orden." };
  }

  if (!hasSupabaseConfig()) {
    await createLocalOrderComment(parsed.data.orderId, user.name, parsed.data.body);
  } else {
    const supabase = await createClient();
    const profileId = await getCurrentProfileId(supabase);
    if (!profileId) return { ok: false, message: "No se pudo identificar tu perfil." };

    const { error } = await supabase.from("order_comments").insert({
      order_id: parsed.data.orderId,
      profile_id: profileId,
      body: parsed.data.body,
    });
    if (error) return { ok: false, message: "No fue posible publicar el comentario." };

    await supabase.from("audit_logs").insert({
      order_id: parsed.data.orderId,
      action: "add_comment",
      entity: "order_comments",
      profile_id: profileId,
      new_value: parsed.data.body.slice(0, 180),
    });
  }

  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  revalidatePath(`/taller/orders/${parsed.data.orderId}`);
  revalidatePath("/taller");
  return { ok: true, message: "Comentario publicado." };
}

export async function uploadOrderAttachment(formData: FormData) {
  const user = await requireSession(["admin", "manager", "operator"]);
  const orderId = formData.get("orderId")?.toString();
  const file = formData.get("file");
  if (!orderId || !(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Selecciona un archivo para subir." };
  }
  if (file.size > maxAttachmentSize) {
    return { ok: false, message: "El archivo supera el máximo de 10 MB." };
  }
  if (!(await canAccessOrder(user, orderId))) {
    return { ok: false, message: "No tienes acceso a esta orden." };
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

async function canAccessOrder(
  user: Awaited<ReturnType<typeof requireSession>>,
  orderId: string,
) {
  const order = await getOrder(orderId);
  if (!order) return false;
  return user.role !== "operator" || canWorkerSeeOrder(user, order);
}
