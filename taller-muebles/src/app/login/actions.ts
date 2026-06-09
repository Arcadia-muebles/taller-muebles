"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUser, signInLocal, signOut } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { getLocalUserByEmail } from "@/lib/local-store";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email("Ingresa un correo valido."),
  password: z.string().min(1, "Ingresa una clave."),
  panel: z.enum(["admin", "taller"]),
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
    panel: formData.get("panel"),
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
    if (parsed.data.panel === "admin" && user.role === "operator") {
      await supabase.auth.signOut();
      return { status: "error", message: "Este usuario es de taller y no puede entrar al panel administrador." };
    }
    if (parsed.data.panel === "taller" && user.role !== "operator") {
      await supabase.auth.signOut();
      return { status: "error", message: "Este usuario no tiene una cuenta de trabajador de taller." };
    }
    redirect(user.role === "operator" ? "/taller" : "/admin");
  } else {
    const localUser = await getLocalUserByEmail(parsed.data.email);
    if (!localUser?.active) {
      return { status: "error", message: "No existe un usuario activo con ese correo." };
    }
    if (parsed.data.panel === "admin" && localUser.role === "operator") {
      return { status: "error", message: "Este usuario es de taller y no puede entrar al panel administrador." };
    }
    if (parsed.data.panel === "taller" && localUser.role !== "operator") {
      return { status: "error", message: "Este usuario no tiene una cuenta de trabajador de taller." };
    }

    await signInLocal(localUser);
    redirect(localUser.role === "operator" ? "/taller" : "/admin");
  }
}

export async function logout() {
  await signOut();
  redirect("/login");
}
