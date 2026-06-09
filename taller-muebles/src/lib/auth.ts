import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AppUser, Role } from "@/lib/types";
import { hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/env";
import { getLocalUserByEmail } from "@/lib/local-store";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const sessionCookie = "tm_session";

export type SessionUser = Pick<AppUser, "id" | "email" | "name" | "role" | "area">;

export async function getSessionUser(): Promise<SessionUser | null> {
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      if (authError) console.error("Supabase session validation failed:", authError.message);
      return null;
    }

    const profileClient = hasSupabaseAdminConfig() ? getSupabaseAdmin() : supabase;
    const { data: profile, error: profileError } = await profileClient
      .from("profiles")
      .select("id, full_name, role, area, active")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile?.active) {
      if (profileError) console.error("Supabase profile lookup failed:", profileError.message);
      return null;
    }
    return {
      id: profile.id,
      email: user.email ?? "",
      name: profile.full_name,
      role: profile.role,
      area: (profile.area as AppUser["area"]) ?? undefined,
    };
  }

  const value = (await cookies()).get(sessionCookie)?.value;
  if (!value) return null;

  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<SessionUser>;
    if (!decoded.email) return null;
    const localUser = await getLocalUserByEmail(decoded.email);
    if (!localUser?.active) return null;
    return {
      id: localUser.id,
      email: localUser.email,
      name: localUser.name,
      role: localUser.role,
      area: localUser.area,
    };
  } catch {
    return null;
  }
}

export async function signInLocal(user: SessionUser) {
  (await cookies()).set(sessionCookie, encodeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function signOutLocal() {
  (await cookies()).delete(sessionCookie);
}

export async function signOut() {
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return;
  }
  await signOutLocal();
}

export async function requireSession(allowedRoles?: Role[]) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirect(user.role === "operator" ? "/taller" : "/admin");
  }

  return user;
}

export function roleLabel(role: Role) {
  const labels: Record<Role, string> = {
    admin: "Administrador",
    manager: "Encargado",
    operator: "Trabajador",
    viewer: "Lectura",
  };
  return labels[role];
}

function encodeSession(user: SessionUser) {
  return Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
}
