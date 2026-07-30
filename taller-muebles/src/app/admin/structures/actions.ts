"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { createLocalStructureRequest, updateLocalStructureRequestStatus } from "@/lib/local-store";
import { isProductionOrder } from "@/lib/orders";
import { getOrder, listStructureRequests } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import { createClient } from "@/lib/supabase/server";
import type { StructureRequestStatus } from "@/lib/types";

const maxAttachmentSize = 10 * 1024 * 1024;

type LooseDb<T> = {
  from: (table: string) => LooseQuery<T>;
};
type LooseQuery<T> = {
  select: (columns?: string) => LooseQuery<T>;
  update: (payload: Record<string, unknown>) => LooseQuery<T>;
  insert: (payload: Record<string, unknown>) => Promise<{ data: T[] | null; error: { message: string } | null }>;
  eq: (column: string, value: string) => LooseQuery<T> & Promise<{ data: T[] | null; error: { message: string } | null }>;
  neq: (column: string, value: string) => LooseQuery<T>;
  maybeSingle: () => Promise<{ data: T | null; error: { message: string } | null }>;
};

type StructureRow = {
  id: string;
  order_id: string;
  specifications: string;
};

type ProductionStepRow = {
  id: string;
};

const structureSchema = z.object({
  orderId: z.string().min(1),
  specifications: z.string().trim().min(3, "Ingresa las especificaciones de estructura.").max(1200),
  status: z.enum(["draft", "requested", "in_progress", "done", "cancelled"]),
  assignedTo: z.string().trim().max(80).optional(),
});

const structureOrderStatusSchema = z.object({
  orderId: z.string().min(1),
  specifications: z.string().trim().min(3).max(1200).optional(),
  status: z.enum(["draft", "requested", "in_progress", "done"]),
});

export type StructureStageResult = { ok: true; message: string } | { ok: false; message: string };

export async function createStructureRequest(formData: FormData) {
  const user = await requireSession(["admin", "manager"]);
  const settings = await getSystemSettings();
  if (user.role === "manager" && !settings.permissions.managersCanEditOrders) return;
  const parsed = structureSchema.safeParse({
    orderId: formData.get("orderId"),
    specifications: formData.get("specifications"),
    status: formData.get("status") || "requested",
    assignedTo: formData.get("assignedTo")?.toString() || undefined,
  });
  if (!parsed.success) return;
  const order = await getOrder(parsed.data.orderId);
  if (!order || !isProductionOrder(order)) return;

  const file = formData.get("file");
  const attachment = file instanceof File && file.size > 0 ? file : undefined;
  if (attachment && attachment.size > maxAttachmentSize) return;

  if (!hasSupabaseConfig()) {
    await createLocalStructureRequest({ ...parsed.data, file: attachment });
  } else {
    const supabase = await createClient();
    const profileId = await getCurrentProfileId(supabase);
    const structureDb = supabase as unknown as LooseDb<StructureRow>;
    const { data: existing } = await structureDb
      .from("structure_requests")
      .select("id")
      .eq("order_id", parsed.data.orderId)
      .neq("status", "cancelled")
      .maybeSingle();

    if (existing?.id) {
      await structureDb.from("structure_requests").update({
        specifications: parsed.data.specifications,
        status: parsed.data.status,
        assigned_to: parsed.data.assignedTo || null,
        completed_at: parsed.data.status === "done" ? new Date().toISOString() : null,
        updated_by: profileId,
      }).eq("id", existing.id);
    } else {
      await structureDb.from("structure_requests").insert({
        order_id: parsed.data.orderId,
        specifications: parsed.data.specifications,
        status: parsed.data.status,
        assigned_to: parsed.data.assignedTo || null,
        requested_by: profileId,
        updated_by: profileId,
        completed_at: parsed.data.status === "done" ? new Date().toISOString() : null,
      });
    }

    if (attachment) {
      await saveStructureAttachment({
        supabase,
        orderId: parsed.data.orderId,
        profileId,
        file: attachment,
      });
    }

    await updateStructureStep({
      supabase,
      orderId: parsed.data.orderId,
      status: parsed.data.status,
      notes: parsed.data.specifications,
      profileId,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/structures");
  revalidatePath("/taller");
}

export async function saveStructureSpecification(formData: FormData) {
  await createStructureRequest(formData);
}

export async function setStructureOrderStatus(formData: FormData) {
  await changeStructureOrderStatus({
    orderId: formData.get("orderId"),
    specifications: formData.get("specifications") || undefined,
    status: formData.get("status"),
  });
}

export async function updateStructureStage(input: {
  orderId: string;
  status: "draft" | "requested" | "in_progress" | "done";
}): Promise<StructureStageResult> {
  return changeStructureOrderStatus(input);
}

async function changeStructureOrderStatus(input: unknown): Promise<StructureStageResult> {
  const user = await requireSession(["admin", "manager"]);
  const settings = await getSystemSettings();
  if (user.role === "manager" && !settings.permissions.managersCanEditOrders) {
    return { ok: false, message: "Tu perfil no tiene permiso para actualizar estructuras." };
  }

  const parsed = structureOrderStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "El cambio de estructura no es válido." };
  const order = await getOrder(parsed.data.orderId);
  if (!order || !isProductionOrder(order)) return { ok: false, message: "No se encontró una orden de producción válida." };
  const structureStep = order.steps.find((step) => step.key === "structure");
  if (parsed.data.status === "draft" && structureStep?.status !== "pending") {
    return { ok: false, message: "No puedes volver a En blanco porque la estructura ya comenzó." };
  }
  const currentRequest = (await listStructureRequests()).find(
    (request) => request.orderId === parsed.data.orderId && request.status !== "cancelled",
  );
  const specifications = parsed.data.specifications ?? currentRequest?.specifications ?? `01 · ${order.product}`;

  if (!hasSupabaseConfig()) {
    const updated = currentRequest
      ? await updateLocalStructureRequestStatus(currentRequest.id, parsed.data.status)
      : await createLocalStructureRequest({
          orderId: parsed.data.orderId,
          specifications,
          status: parsed.data.status,
        });
    if (!updated) return { ok: false, message: "No fue posible guardar el estado de la estructura." };
  } else {
    const supabase = await createClient();
    const profileId = await getCurrentProfileId(supabase);
    const structureDb = supabase as unknown as LooseDb<StructureRow>;
    const { data: existing } = await structureDb
      .from("structure_requests")
      .select("id")
      .eq("order_id", parsed.data.orderId)
      .neq("status", "cancelled")
      .maybeSingle();

    if (existing?.id) {
      await structureDb.from("structure_requests").update({
        specifications,
        status: parsed.data.status,
        completed_at: parsed.data.status === "done" ? new Date().toISOString() : null,
        updated_by: profileId,
      }).eq("id", existing.id);
    } else {
      await structureDb.from("structure_requests").insert({
        order_id: parsed.data.orderId,
        specifications,
        status: parsed.data.status,
        requested_by: profileId,
        updated_by: profileId,
        completed_at: parsed.data.status === "done" ? new Date().toISOString() : null,
      });
    }

    await updateStructureStep({
      supabase,
      orderId: parsed.data.orderId,
      status: parsed.data.status,
      notes: specifications,
      profileId,
    });
    await supabase.from("audit_logs").insert({
      order_id: parsed.data.orderId,
      action: "structure_status",
      entity: "structure_requests",
      entity_id: existing?.id ?? parsed.data.orderId,
      profile_id: profileId,
      field_name: "status",
      old_value: currentRequest?.status ?? "unrequested",
      new_value: parsed.data.status,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/ready");
  revalidatePath("/admin/structures");
  revalidatePath("/taller");
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  revalidatePath(`/taller/orders/${parsed.data.orderId}`);
  return { ok: true, message: structureStageMessage(parsed.data.status) };
}

export async function setStructureRequestStatus(formData: FormData) {
  await requireSession(["admin", "manager"]);
  const id = formData.get("id")?.toString();
  const status = formData.get("status")?.toString() as StructureRequestStatus | undefined;
  if (!id || !status) return;

  if (!hasSupabaseConfig()) {
    await updateLocalStructureRequestStatus(id, status);
  } else {
    const supabase = await createClient();
    const profileId = await getCurrentProfileId(supabase);
    const structureDb = supabase as unknown as LooseDb<StructureRow>;
    const { data: request } = await structureDb
      .from("structure_requests")
      .select("order_id, specifications")
      .eq("id", id)
      .maybeSingle();
    if (!request) return;
    await structureDb.from("structure_requests").update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
      updated_by: profileId,
    }).eq("id", id);
    await updateStructureStep({
      supabase,
      orderId: request.order_id,
      status,
      notes: request.specifications,
      profileId,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/structures");
  revalidatePath("/taller");
}

async function updateStructureStep({
  supabase,
  orderId,
  status,
  notes,
  profileId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  orderId: string;
  status: StructureRequestStatus;
  notes: string;
  profileId: string | null;
}) {
  const now = new Date().toISOString();
  const patch =
    status === "done"
      ? { status: "done", started_at: now, completed_at: now, blocked_reason: null, notes, updated_by: profileId }
      : status === "in_progress"
        ? { status: "active", started_at: now, completed_at: null, blocked_reason: null, notes, updated_by: profileId }
        : { status: "pending", started_at: null, completed_at: null, blocked_reason: null, notes, updated_by: profileId };
  await (supabase as unknown as LooseDb<ProductionStepRow>).from("production_steps").update(patch).eq("order_id", orderId).eq("step", "structure");
}

function structureStageMessage(status: "draft" | "requested" | "in_progress" | "done") {
  const labels = {
    draft: "La estructura quedó En blanco.",
    requested: "La estructura quedó Pedida.",
    in_progress: "La estructura quedó En estructura.",
    done: "La estructura quedó Lista.",
  };
  return labels[status];
}

async function saveStructureAttachment({
  supabase,
  orderId,
  profileId,
  file,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  orderId: string;
  profileId: string | null;
  file: File;
}) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${orderId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("order-attachments")
    .upload(storagePath, file, { contentType: file.type || "application/octet-stream" });
  if (uploadError) return;
  await supabase.from("order_attachments").insert({
    order_id: orderId,
    file_name: file.name,
    file_type: file.type || "application/octet-stream",
    file_size_bytes: file.size,
    storage_path: storagePath,
    uploaded_by: profileId,
  });
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
