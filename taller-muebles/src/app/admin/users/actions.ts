"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/env";
import { getLocalUserByEmail, setLocalUserActive, updateLocalUser, upsertLocalUser } from "@/lib/local-store";
import { getSystemSettings } from "@/lib/repositories/settings";
import { moduleAccessKeys } from "@/lib/module-access";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const userSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(2),
  role: z.enum(["admin", "manager", "operator"]),
  areas: z.array(z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/)).optional(),
  password: z.string().min(8).optional(),
});

export type UserActionResult = { ok: boolean; message: string };

export async function createUser(formData: FormData): Promise<UserActionResult> {
  const session = await requireSession(["admin"]);
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
    const areaError = await validateAreas(parsed.data);
    if (areaError) return { ok: false, message: areaError };
    if (!hasSupabaseConfig()) {
      if (await getLocalUserByEmail(parsed.data.email)) {
        return { ok: false, message: "Ya existe una cuenta con ese correo. Edita o reactiva la cuenta existente." };
      }
      await upsertLocalUser({
        email: parsed.data.email,
        name: parsed.data.name,
        role: parsed.data.role,
        area: parsed.data.role === "operator" ? parsed.data.areas?.[0] : undefined,
        areas: parsed.data.role === "operator" ? parsed.data.areas : undefined,
      }, session.id);
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
      const { error: profileError } = await (await createClient()).from("profiles").insert({
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

export async function setUserActive(formData: FormData): Promise<UserActionResult> {
  const session = await requireSession(["admin"]);
  const id = formData.get("userId")?.toString();
  const activeValue = formData.get("active");
  if (!id || !["true", "false"].includes(String(activeValue))) return { ok: false, message: "Solicitud inválida." };
  if (id === session.id) return { ok: false, message: "No puedes desactivar tu propia cuenta." };
  const active = activeValue === "true";
  try {
    if (!hasSupabaseConfig()) {
      if (!await setLocalUserActive(id, active, session.id)) return { ok: false, message: "No se encontró una cuenta interna válida." };
    } else {
      if (!hasSupabaseAdminConfig()) return { ok: false, message: "Falta configurar el servicio de administración de cuentas." };
      const { data, error } = await (await createClient()).from("profiles")
        .update({ active }).eq("id", id).neq("role", "viewer").select("id").maybeSingle();
      if (error || !data) return { ok: false, message: "No fue posible cambiar el acceso de la cuenta." };
    }
  } catch {
    return { ok: false, message: "No fue posible cambiar el acceso. Intenta nuevamente." };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: active ? "Cuenta reactivada." : "Cuenta desactivada. Se conserva su historial." };
}

const updateUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2),
  role: z.enum(["admin", "manager", "operator"]),
  areas: z.array(z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/)).optional(),
});

export async function updateUser(formData: FormData): Promise<UserActionResult> {
  const session = await requireSession(["admin"]);
  const parsed = updateUserSchema.safeParse({
    id: formData.get("userId"),
    name: formData.get("name"),
    role: formData.get("role"),
    areas: formData.getAll("areas").map(String).filter(Boolean),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos del usuario." };
  }

  try {
    if (parsed.data.id === session.id && parsed.data.role !== "admin") {
      return { ok: false, message: "No puedes quitarte el rol de administrador desde tu propia cuenta." };
    }
    const areaError = await validateAreas(parsed.data);
    if (areaError) return { ok: false, message: areaError };
    if (!hasSupabaseConfig()) {
      const updated = await updateLocalUser({
        id: parsed.data.id,
        name: parsed.data.name,
        role: parsed.data.role,
        area: parsed.data.role === "operator" ? parsed.data.areas?.[0] : undefined,
        areas: parsed.data.role === "operator" ? parsed.data.areas : undefined,
      }, session.id);
      if (!updated) return { ok: false, message: "No se encontró el usuario." };
    } else {
      if (!hasSupabaseAdminConfig()) {
        return { ok: false, message: "Falta configurar la clave de servicio para administrar cuentas." };
      }
      const { data, error } = await (await createClient())
        .from("profiles")
        .update({
          full_name: parsed.data.name,
          role: parsed.data.role,
          area: parsed.data.role === "operator" ? (parsed.data.areas ?? []).join(",") || null : null,
        })
        .eq("id", parsed.data.id).select("id").maybeSingle();
      if (error) return { ok: false, message: error.message };
      if (!data) return { ok: false, message: "No se encontró el usuario." };
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

async function validateAreas(user: { role: string; areas?: string[] }) {
  if (user.role !== "operator") return;
  if (!user.areas?.length) return "Asigna al menos un proceso o módulo al trabajador.";
  const settings = await getSystemSettings();
  const allowed = new Set([
    ...settings.production.steps.filter((step) => step.enabled).map((step) => step.key),
    moduleAccessKeys.commercial,
  ]);
  if (user.areas.some((area) => !allowed.has(area))) return "Selecciona únicamente procesos o módulos habilitados.";
}
