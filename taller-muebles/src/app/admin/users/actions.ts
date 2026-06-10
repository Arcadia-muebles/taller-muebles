"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/env";
import { deactivateLocalUser, updateLocalUser, upsertLocalUser } from "@/lib/local-store";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(2),
  role: z.enum(["admin", "manager", "operator", "viewer"]),
  areas: z.array(z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/)).optional(),
  password: z.string().min(8).optional(),
});

export type UserActionResult = { ok: boolean; message: string };

export async function createUser(formData: FormData): Promise<UserActionResult> {
  await requireSession(["admin"]);
  const parsed = userSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
    areas: formData.getAll("areas").map(String).filter(Boolean),
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
        area: parsed.data.role === "operator" ? parsed.data.areas?.[0] : undefined,
        areas: parsed.data.role === "operator" ? parsed.data.areas : undefined,
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
        area: parsed.data.role === "operator" ? (parsed.data.areas ?? []).join(",") || null : null,
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

const updateUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2),
  role: z.enum(["admin", "manager", "operator", "viewer"]),
  areas: z.array(z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/)).optional(),
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export async function updateUser(formData: FormData): Promise<UserActionResult> {
  await requireSession(["admin"]);
  const parsed = updateUserSchema.safeParse({
    id: formData.get("userId"),
    name: formData.get("name"),
    role: formData.get("role"),
    areas: formData.getAll("areas").map(String).filter(Boolean),
    active: formData.get("active") ?? "false",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos del usuario." };
  }

  try {
    if (!hasSupabaseConfig()) {
      const updated = await updateLocalUser({
        id: parsed.data.id,
        name: parsed.data.name,
        role: parsed.data.role,
        area: parsed.data.role === "operator" ? parsed.data.areas?.[0] : undefined,
        areas: parsed.data.role === "operator" ? parsed.data.areas : undefined,
        active: parsed.data.active,
      });
      if (!updated) return { ok: false, message: "No se encontro el usuario." };
    } else {
      if (!hasSupabaseAdminConfig()) {
        return { ok: false, message: "Falta configurar la clave de servicio para administrar cuentas." };
      }
      const { error } = await getSupabaseAdmin()
        .from("profiles")
        .update({
          full_name: parsed.data.name,
          role: parsed.data.role,
          area: parsed.data.role === "operator" ? (parsed.data.areas ?? []).join(",") || null : null,
          active: parsed.data.active,
        })
        .eq("id", parsed.data.id);
      if (error) return { ok: false, message: error.message };
    }
  } catch (error) {
    console.error("User update failed:", error);
    return { ok: false, message: "No fue posible actualizar el usuario." };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  revalidatePath("/taller");
  return { ok: true, message: "Usuario actualizado." };
}
