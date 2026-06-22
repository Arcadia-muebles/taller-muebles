"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { dashboardPathForRole, getSessionUser, signInLocal, signOut } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { getLocalUserByEmail } from "@/lib/local-store";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email("Ingresa un correo valido."),
  password: z.string().min(1, "Ingresa una clave."),
});

export type LoginState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function requestLogin(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revisa el correo ingresado.",
    };
  }

  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) return { status: "error", message: "Correo o clave incorrectos." };

    const user = await getSessionUser();
    if (!user) {
      await supabase.auth.signOut();
      return { status: "error", message: "Tu perfil no esta activo o no tiene permisos asignados." };
    }
    redirect(dashboardPathForRole(user.role));
  } else {
    const localUser = await getLocalUserByEmail(parsed.data.email);
    if (!localUser?.active) {
      return { status: "error", message: "No existe un usuario activo con ese correo." };
    }
    await signInLocal(localUser);
    redirect(dashboardPathForRole(localUser.role));
  }
}

export async function logout() {
  await signOut();
  redirect("/login");
}
