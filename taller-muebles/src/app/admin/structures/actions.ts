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

type DbError = { message: string } | null;
type DbResult<T> = { data: T | null; error: DbError };
type LooseDb<T> = { from: (table: string) => LooseQuery<T> };
type LooseQuery<T> = {
  select: (columns?: string) => LooseQuery<T>;
  update: (payload: Record<string, unknown>) => LooseQuery<T>;
  insert: (payload: Record<string, unknown>) => LooseQuery<T>;
  eq: (column: string, value: string) => LooseQuery<T>;
  neq: (column: string, value: string) => LooseQuery<T>;
  maybeSingle: () => Promise<DbResult<T>>;
};

type StructureRow = {
  id: string;
  order_id: string;
  specifications: string;
  status: StructureRequestStatus;
  assigned_to: string | null;
  updated_at: string;
};

type ProductionStepRow = {
  id: string;
  status: "pending" | "active" | "done" | "blocked";
  started_at: string | null;
  completed_at: string | null;
};

const editableStructureStatuses = ["draft", "requested", "in_progress", "done"] as const;

const structureSchema = z.object({
  orderId: z.string().min(1),
  requestId: z.string().optional(),
  expectedUpdatedAt: z.string().optional(),
  expectNoRequest: z.literal("1").optional(),
  specifications: z.string().trim().min(3, "Ingresa una descripción de al menos 3 caracteres.").max(1200, "La descripción no puede superar 1.200 caracteres."),
  status: z.enum(editableStructureStatuses),
  assignedTo: z.string().trim().max(80, "El responsable no puede superar 80 caracteres.").optional(),
});

const structureOrderStatusSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(editableStructureStatuses),
});

export type StructureActionResult = { ok: boolean; message: string };
export type StructureStageResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function createStructureRequest(formData: FormData): Promise<StructureActionResult> {
  const user = await requireSession(["admin", "manager"]);
  const settings = await getSystemSettings();
  if (user.role === "manager" && !settings.permissions.managersCanEditOrders) {
    return { ok: false, message: "Tu perfil no tiene permiso para actualizar estructuras." };
  }

  const parsed = structureSchema.safeParse({
    orderId: formData.get("orderId"),
    requestId: formData.get("requestId")?.toString() || undefined,
    expectedUpdatedAt: formData.get("expectedUpdatedAt")?.toString() || undefined,
    expectNoRequest: formData.get("expectNoRequest")?.toString() || undefined,
    specifications: formData.get("specifications"),
    status: formData.get("status") || "requested",
    assignedTo: formData.get("assignedTo")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos de la ficha." };
  }

  const order = await getOrder(parsed.data.orderId);
  if (!order || !isProductionOrder(order)) {
    return { ok: false, message: "No se encontró una orden de producción válida." };
  }
  const structureStep = order.steps.find((step) => step.key === "structure");
  if (parsed.data.status === "draft" && structureStep?.status !== "pending") {
    return { ok: false, message: "No puedes volver a En blanco porque la estructura ya comenzó." };
  }

  const fileValue = formData.get("file");
  const attachment = fileValue instanceof File && fileValue.size > 0 ? fileValue : undefined;
  const attachmentError = validateAttachment(attachment);
  if (attachmentError) return { ok: false, message: attachmentError };

  if (!hasSupabaseConfig()) {
    const saved = await createLocalStructureRequest({
      ...parsed.data,
      expectNoRequest: parsed.data.expectNoRequest === "1",
      file: attachment,
    });
    if (!saved) {
      return {
        ok: false,
        message: "La ficha cambió desde que la abriste. Recarga la página antes de volver a guardar.",
      };
    }
    revalidateStructurePaths(parsed.data.orderId);
    return { ok: true, message: "Descripción y estado guardados correctamente." };
  }

  const supabase = await createClient();
  const structureDb = supabase as unknown as LooseDb<StructureRow>;
  const { data: existing, error: existingError } = await structureDb
    .from("structure_requests")
    .select("id, order_id, specifications, status, assigned_to, updated_at")
    .eq("order_id", parsed.data.orderId)
    .neq("status", "cancelled")
    .maybeSingle();

  if (existingError) {
    console.error("Supabase structure lookup failed:", existingError.message);
    return { ok: false, message: "No fue posible comprobar la versión actual de la ficha. No se guardaron cambios." };
  }
  if (existing && parsed.data.requestId && parsed.data.requestId !== existing.id) {
    return conflictResult();
  }
  if (existing && parsed.data.expectNoRequest === "1") return conflictResult();
  if (existing && parsed.data.expectedUpdatedAt && parsed.data.expectedUpdatedAt !== existing.updated_at) {
    return conflictResult();
  }
  if (!existing && parsed.data.requestId) return conflictResult();

  const now = new Date().toISOString();
  let savedRequest: StructureRow | null = null;
  if (existing) {
    let updateQuery = structureDb
      .from("structure_requests")
      .update({
        specifications: parsed.data.specifications,
        status: parsed.data.status,
        assigned_to: parsed.data.assignedTo || null,
        completed_at: parsed.data.status === "done" ? (existing.status === "done" ? undefined : now) : null,
        updated_by: user.id,
      })
      .eq("id", existing.id);
    if (parsed.data.expectedUpdatedAt) {
      updateQuery = updateQuery.eq("updated_at", parsed.data.expectedUpdatedAt);
    }
    const { data, error } = await updateQuery
      .select("id, order_id, specifications, status, assigned_to, updated_at")
      .maybeSingle();
    if (error) {
      console.error("Supabase structure update failed:", error.message);
      return { ok: false, message: "Supabase rechazó la actualización. No se guardaron cambios." };
    }
    if (!data) return conflictResult();
    savedRequest = data;
  } else {
    const { data, error } = await structureDb
      .from("structure_requests")
      .insert({
        order_id: parsed.data.orderId,
        specifications: parsed.data.specifications,
        status: parsed.data.status,
        assigned_to: parsed.data.assignedTo || null,
        requested_by: user.id,
        updated_by: user.id,
        completed_at: parsed.data.status === "done" ? now : null,
      })
      .select("id, order_id, specifications, status, assigned_to, updated_at")
      .maybeSingle();
    if (error || !data) {
      if (error) console.error("Supabase structure insert failed:", error.message);
      return { ok: false, message: "No fue posible crear la ficha de estructura en Supabase." };
    }
    savedRequest = data;
  }

  const warnings: string[] = [];
  const stepResult = await updateStructureStep({
    supabase,
    orderId: parsed.data.orderId,
    status: parsed.data.status,
    notes: parsed.data.specifications,
    profileId: user.id,
  });
  if (!stepResult.ok) warnings.push("el paso productivo no se sincronizó");

  const auditError = await auditStructureChanges({
    supabase,
    orderId: parsed.data.orderId,
    profileId: user.id,
    requestId: savedRequest.id,
    previous: existing,
    current: savedRequest,
  });
  if (auditError) warnings.push("la auditoría no pudo registrarse");

  if (attachment) {
    const fileError = await saveStructureAttachment({
      supabase,
      orderId: parsed.data.orderId,
      profileId: user.id,
      file: attachment,
    });
    if (fileError) warnings.push("el archivo adjunto no pudo guardarse");
  }

  revalidateStructurePaths(parsed.data.orderId);
  if (warnings.length) {
    return {
      ok: false,
      message: `La descripción se guardó, pero ${formatWarnings(warnings)}. Revisa la ficha antes de continuar.`,
    };
  }
  return { ok: true, message: "Descripción y estado guardados correctamente." };
}

export async function saveStructureSpecification(
  _previousState: StructureActionResult,
  formData: FormData,
): Promise<StructureActionResult> {
  return createStructureRequest(formData);
}

export async function setStructureOrderStatus(formData: FormData): Promise<StructureStageResult> {
  return changeStructureOrderStatus({
    orderId: formData.get("orderId"),
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
  if (!order || !isProductionOrder(order)) {
    return { ok: false, message: "No se encontró una orden de producción válida." };
  }
  const structureStep = order.steps.find((step) => step.key === "structure");
  if (parsed.data.status === "draft" && structureStep?.status !== "pending") {
    return { ok: false, message: "No puedes volver a En blanco porque la estructura ya comenzó." };
  }

  if (!hasSupabaseConfig()) {
    const currentRequest = (await listStructureRequests()).find(
      (request) => request.orderId === parsed.data.orderId && request.status !== "cancelled",
    );
    const updated = currentRequest
      ? await updateLocalStructureRequestStatus(currentRequest.id, parsed.data.status)
      : await createLocalStructureRequest({
          orderId: parsed.data.orderId,
          specifications: `01 · ${order.product}`,
          status: parsed.data.status,
        });
    if (!updated) return { ok: false, message: "No fue posible guardar el estado de la estructura." };
  } else {
    const supabase = await createClient();
    const structureDb = supabase as unknown as LooseDb<StructureRow>;
    const { data: existing, error: lookupError } = await structureDb
      .from("structure_requests")
      .select("id, order_id, specifications, status, assigned_to, updated_at")
      .eq("order_id", parsed.data.orderId)
      .neq("status", "cancelled")
      .maybeSingle();
    if (lookupError) {
      console.error("Supabase structure status lookup failed:", lookupError.message);
      return { ok: false, message: "No fue posible comprobar el estado actual. No se guardaron cambios." };
    }

    const specifications = existing?.specifications ?? `01 · ${order.product}`;
    const now = new Date().toISOString();
    let savedRequest: StructureRow | null = null;
    if (existing) {
      const { data, error } = await structureDb
        .from("structure_requests")
        .update({
          status: parsed.data.status,
          completed_at: parsed.data.status === "done" ? (existing.status === "done" ? undefined : now) : null,
          updated_by: user.id,
        })
        .eq("id", existing.id)
        .select("id, order_id, specifications, status, assigned_to, updated_at")
        .maybeSingle();
      if (error || !data) {
        if (error) console.error("Supabase structure status update failed:", error.message);
        return { ok: false, message: "No fue posible guardar el estado de la estructura." };
      }
      savedRequest = data;
    } else {
      const { data, error } = await structureDb
        .from("structure_requests")
        .insert({
          order_id: parsed.data.orderId,
          specifications,
          status: parsed.data.status,
          requested_by: user.id,
          updated_by: user.id,
          completed_at: parsed.data.status === "done" ? now : null,
        })
        .select("id, order_id, specifications, status, assigned_to, updated_at")
        .maybeSingle();
      if (error || !data) {
        if (error) console.error("Supabase structure status insert failed:", error.message);
        return { ok: false, message: "No fue posible crear la ficha de estructura." };
      }
      savedRequest = data;
    }

    const stepResult = await updateStructureStep({
      supabase,
      orderId: parsed.data.orderId,
      status: parsed.data.status,
      notes: specifications,
      profileId: user.id,
    });
    if (!stepResult.ok) {
      revalidateStructurePaths(parsed.data.orderId);
      return {
        ok: false,
        message: "El estado de la ficha se guardó, pero el paso productivo no se sincronizó.",
      };
    }

    const auditError = await auditStructureChanges({
      supabase,
      orderId: parsed.data.orderId,
      profileId: user.id,
      requestId: savedRequest.id,
      previous: existing,
      current: savedRequest,
    });
    if (auditError) {
      revalidateStructurePaths(parsed.data.orderId);
      return { ok: false, message: "El estado se guardó, pero no pudo registrarse en auditoría." };
    }
  }

  revalidateStructurePaths(parsed.data.orderId);
  return { ok: true, message: structureStageMessage(parsed.data.status) };
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
  profileId: string;
}): Promise<{ ok: boolean }> {
  const stepDb = supabase as unknown as LooseDb<ProductionStepRow>;
  const { data: current, error: readError } = await stepDb
    .from("production_steps")
    .select("id, status, started_at, completed_at")
    .eq("order_id", orderId)
    .eq("step", "structure")
    .maybeSingle();
  if (readError || !current) {
    if (readError) console.error("Supabase structure step lookup failed:", readError.message);
    return { ok: false };
  }

  const now = new Date().toISOString();
  const patch =
    status === "done"
      ? {
          status: "done",
          started_at: current.started_at ?? now,
          completed_at: current.status === "done" ? (current.completed_at ?? now) : now,
          blocked_reason: null,
          notes,
          updated_by: profileId,
        }
      : status === "in_progress"
        ? {
            status: "active",
            started_at: current.started_at ?? now,
            completed_at: null,
            blocked_reason: null,
            notes,
            updated_by: profileId,
          }
        : {
            status: "pending",
            started_at: null,
            completed_at: null,
            blocked_reason: null,
            notes,
            updated_by: profileId,
          };

  const { data: updated, error } = await stepDb
    .from("production_steps")
    .update(patch)
    .eq("id", current.id)
    .select("id, status, started_at, completed_at")
    .maybeSingle();
  if (error || !updated) {
    if (error) console.error("Supabase structure step update failed:", error.message);
    return { ok: false };
  }
  return { ok: true };
}

async function auditStructureChanges({
  supabase,
  orderId,
  profileId,
  requestId,
  previous,
  current,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  orderId: string;
  profileId: string;
  requestId: string;
  previous: StructureRow | null;
  current: StructureRow;
}) {
  const changes = [
    ["specifications", previous?.specifications ?? null, current.specifications],
    ["assigned_to", previous?.assigned_to ?? null, current.assigned_to],
    ["status", previous?.status ?? "unrequested", current.status],
  ].filter(([, oldValue, newValue]) => oldValue !== newValue);
  if (!changes.length) return false;

  const { error } = await supabase.from("audit_logs").insert(
    changes.map(([fieldName, oldValue, newValue]) => ({
      order_id: orderId,
      action: previous ? "structure_update" : "structure_create",
      entity: "structure_requests",
      entity_id: requestId,
      profile_id: profileId,
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue,
    })),
  );
  if (error) console.error("Supabase structure audit insert failed:", error.message);
  return Boolean(error);
}

function structureStageMessage(status: "draft" | "requested" | "in_progress" | "done") {
  return {
    draft: "La estructura quedó En blanco.",
    requested: "La estructura quedó Pedida.",
    in_progress: "La estructura quedó En estructura.",
    done: "La estructura quedó Lista.",
  }[status];
}

async function saveStructureAttachment({
  supabase,
  orderId,
  profileId,
  file,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  orderId: string;
  profileId: string;
  file: File;
}) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${orderId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("order-attachments")
    .upload(storagePath, file, { contentType: file.type || "application/octet-stream" });
  if (uploadError) {
    console.error("Supabase structure attachment upload failed:", uploadError.message);
    return uploadError.message;
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
    console.error("Supabase structure attachment metadata failed:", metadataError.message);
    return metadataError.message;
  }
  return null;
}

function validateAttachment(file?: File) {
  if (!file) return null;
  if (file.size > maxAttachmentSize) return "El archivo supera el máximo permitido de 10 MB.";
  if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
    return "Adjunta una imagen o un archivo PDF.";
  }
  return null;
}

function conflictResult(): StructureActionResult {
  return {
    ok: false,
    message: "Otra persona actualizó esta ficha. Recarga la página para conservar la información más reciente.",
  };
}

function revalidateStructurePaths(orderId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/ready");
  revalidatePath("/admin/structures");
  revalidatePath("/taller");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/taller/orders/${orderId}`);
}

function formatWarnings(warnings: string[]) {
  if (warnings.length === 1) return warnings[0];
  return `${warnings.slice(0, -1).join(", ")} y ${warnings.at(-1)}`;
}
