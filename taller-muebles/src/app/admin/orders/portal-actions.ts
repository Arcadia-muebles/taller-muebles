"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createClientPortalAccess, revokeClientPortalAccess } from "@/lib/client-portal";
import { getOrder } from "@/lib/repositories/production";

const orderIdSchema = z.string().uuid();

export type ClientPortalActionState = {
  ok: boolean;
  message: string;
  path?: string;
  expiresAt?: string;
};

export async function generateClientPortalLink(
  _state: ClientPortalActionState,
  formData: FormData,
): Promise<ClientPortalActionState> {
  const user = await requireSession(["admin"]);
  const parsed = orderIdSchema.safeParse(formData.get("orderId"));
  if (!parsed.success) return { ok: false, message: "La orden no es válida." };
  if (!(await getOrder(parsed.data))) return { ok: false, message: "La orden ya no existe." };

  try {
    const result = await createClientPortalAccess({
      orderId: parsed.data,
      profileId: user.id,
      actorName: user.name,
    });
    revalidatePath(`/admin/orders/${parsed.data}`);
    return {
      ok: true,
      message: "Enlace creado. Cópialo ahora para compartirlo con el cliente.",
      path: `/seguimiento/${result.token}`,
      expiresAt: result.expiresAt,
    };
  } catch (error) {
    console.error("Client portal link creation failed:", error);
    return { ok: false, message: "No fue posible crear el enlace de seguimiento." };
  }
}

export async function revokeClientPortalLink(
  _state: ClientPortalActionState,
  formData: FormData,
): Promise<ClientPortalActionState> {
  const user = await requireSession(["admin"]);
  const parsed = orderIdSchema.safeParse(formData.get("orderId"));
  if (!parsed.success) return { ok: false, message: "La orden no es válida." };

  try {
    await revokeClientPortalAccess({
      orderId: parsed.data,
      profileId: user.id,
      actorName: user.name,
    });
    revalidatePath(`/admin/orders/${parsed.data}`);
    return { ok: true, message: "El enlace quedó revocado." };
  } catch (error) {
    console.error("Client portal link revocation failed:", error);
    return { ok: false, message: "No fue posible revocar el enlace." };
  }
}
