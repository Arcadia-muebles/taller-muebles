"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/env";
import { deactivateLocalUser, upsertLocalUser } from "@/lib/local-store";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(2),
  role: z.enum(["admin", "manager", "operator", "viewer"]),
  area: z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/).optional(),
  password: z.string().min(8).optional(),
});

export type UserActionResult = { ok: boolean; message: string };

export async function createUser(formData: FormData): Promise<UserActionResult> {
  await requireSession(["admin"]);
  const parsed = userSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
    area: formData.get("area") || undefined,
    password: formData.get("password") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos del usuario." };
  }
  if (hasSupabaseConfig() && !parsed.data.password) {
    return { ok: false, message: "Ingresa una clave temporal de al menos 8 caracteres." };
  }

  try {
    if (!hasSupabaseConfig()) {
      await upsertLocalUser({
        email: parsed.data.email,
        name: parsed.data.name,
        role: parsed.data.role,
        area: parsed.data.role === "operator" ? parsed.data.area : undefined,
      });
    } else {
      if (!hasSupabaseAdminConfig()) {
        return { ok: false, message: "Falta configurar la clave de servicio para administrar cuentas." };
      }
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.auth.admin.createUser({
        email: parsed.data.email,
        password: parsed.data.password,
        email_confirm: true,
      });
      if (error || !data.user) {
        return { ok: false, message: error?.message ?? "No fue posible crear la cuenta." };
      }
      const { error: profileError } = await admin.from("profiles").insert({
        user_id: data.user.id,
        full_name: parsed.data.name,
        role: parsed.data.role,
        area: parsed.data.role === "operator" ? parsed.data.area ?? null : null,
      });
      if (profileError) {
        await admin.auth.admin.deleteUser(data.user.id);
        return { ok: false, message: `No fue posible crear el perfil: ${profileError.message}` };
      }
    }
  } catch (error) {
    console.error("User creation failed:", error);
    return { ok: false, message: "No fue posible crear el usuario. Intenta nuevamente." };
  }
  revalidatePath("/admin/users");
  return { ok: true, message: "Usuario creado correctamente." };
}

export async function removeUser(formData: FormData) {
  await requireSession(["admin"]);
  const id = formData.get("userId")?.toString();
  if (!id) return;

  if (!hasSupabaseConfig()) {
    await deactivateLocalUser(id);
  } else {
    if (!hasSupabaseAdminConfig()) return;
    const admin = getSupabaseAdmin();
    await admin.from("profiles").update({ active: false }).eq("id", id);
  }
  revalidatePath("/admin/users");
}
