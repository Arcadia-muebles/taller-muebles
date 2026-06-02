"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email("Ingresa un correo valido."),
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
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revisa el correo ingresado.",
    };
  }

  if (!hasSupabaseConfig()) {
    return {
      status: "success",
      message:
        "Modo demo: cuando Supabase este configurado, se enviara un enlace de acceso a este correo.",
    };
  }

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/admin`,
    },
  });

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  return {
    status: "success",
    message: "Te enviamos un enlace de acceso. Revisa tu correo.",
  };
}
