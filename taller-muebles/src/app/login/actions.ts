"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUser, signInLocal, signOut } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email("Ingresa un correo valido."),
  password: z.string().min(1, "Ingresa una clave."),
  panel: z.enum(["admin", "taller"]),
  area: z.enum(["structure", "cutting", "sewing", "upholstery", "quality"]).optional(),
}).superRefine((input, context) => {
  if (input.panel === "taller" && !input.area) {
    context.addIssue({
      code: "custom",
      path: ["area"],
      message: "Selecciona el area asignada.",
    });
  }
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
    area: formData.get("area") || undefined,
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
      return { status: "error", message: "Tu perfil no está activo o no tiene permisos asignados." };
    }
    redirect(user.role === "operator" ? "/taller" : "/admin");
  } else {
    const role = parsed.data.panel === "admin" ? "admin" : "operator";
    await signInLocal({
      email: parsed.data.email,
      name: parsed.data.email.split("@")[0] ?? parsed.data.email,
      role,
      area: role === "operator" ? parsed.data.area : undefined,
    });

    redirect(parsed.data.panel === "taller" ? "/taller" : "/admin");
  }
}

export async function logout() {
  await signOut();
  redirect("/login");
}
