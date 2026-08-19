"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import {
  createClientPortalAccess,
  revokeClientPortalAccessById,
  updateClientPortalAccess,
} from "@/lib/client-portal";
import { getOrder } from "@/lib/repositories/production";

const orderIdSchema = z.string().trim().min(1).max(100);
const linkIdSchema = z.string().uuid();
const lifetimeDaysSchema = z.coerce.number().int().min(1).max(365);

export type ClientPortalActionResult = {
  ok: boolean;
  message: string;
  path?: string;
  expiresAt?: string;
};

export async function createClientPortalLink(formData: FormData): Promise<ClientPortalActionResult> {
  const user = await requireSession(["admin"]);
  const orderId = orderIdSchema.safeParse(formData.get("orderId"));
  const lifetimeDays = lifetimeDaysSchema.safeParse(formData.get("lifetimeDays"));
  if (!orderId.success || !lifetimeDays.success) {
    return { ok: false, message: "Revisa el cliente y la vigencia seleccionada." };
  }

  const order = await getOrder(orderId.data);
  if (!order) return { ok: false, message: "El pedido ya no existe." };
  if (order.documentType === "quote") return { ok: false, message: "Las cotizaciones no tienen seguimiento." };

  try {
    const result = await createClientPortalAccess({
      orderId: orderId.data,
      profileId: user.id,
      actorName: user.name,
      lifetimeDays: lifetimeDays.data,
    });
    revalidatePath("/admin/client-portals");
    return {
      ok: true,
      message: "Enlace creado. Cópialo ahora para enviarlo al cliente.",
      path: `/seguimiento/${result.token}`,
      expiresAt: result.expiresAt,
    };
  } catch (error) {
    console.error("Client portal link creation failed:", error);
    return { ok: false, message: "No fue posible crear el enlace." };
  }
}

export async function updateClientPortalLink(formData: FormData): Promise<ClientPortalActionResult> {
  const user = await requireSession(["admin"]);
  const linkId = linkIdSchema.safeParse(formData.get("linkId"));
  const lifetimeDays = lifetimeDaysSchema.safeParse(formData.get("lifetimeDays"));
  if (!linkId.success || !lifetimeDays.success) {
    return { ok: false, message: "La vigencia seleccionada no es válida." };
  }

  try {
    const result = await updateClientPortalAccess({
      linkId: linkId.data,
      lifetimeDays: lifetimeDays.data,
      actorName: user.name,
    });
    revalidatePath("/admin/client-portals");
    return { ok: true, message: "Vigencia actualizada.", expiresAt: result.expiresAt };
  } catch (error) {
    console.error("Client portal link update failed:", error);
    return { ok: false, message: "No fue posible actualizar el enlace." };
  }
}

export async function revokeClientPortalLink(formData: FormData): Promise<ClientPortalActionResult> {
  const user = await requireSession(["admin"]);
  const linkId = linkIdSchema.safeParse(formData.get("linkId"));
  if (!linkId.success) return { ok: false, message: "El enlace no es válido." };

  try {
    await revokeClientPortalAccessById({
      linkId: linkId.data,
      actorName: user.name,
    });
    revalidatePath("/admin/client-portals");
    return { ok: true, message: "El acceso fue eliminado y quedó registrado en auditoría." };
  } catch (error) {
    console.error("Client portal link revocation failed:", error);
    return { ok: false, message: "No fue posible eliminar el acceso." };
  }
}
