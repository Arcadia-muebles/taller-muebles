export function hasSupabaseConfig() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (process.env.NODE_ENV === "production") {
    if (process.env.LOCAL_DEMO_MODE === "1") {
      throw new Error("LOCAL_DEMO_MODE no puede habilitarse en producción.");
    }
    if (!configured) {
      throw new Error("Falta la configuración obligatoria de Supabase para producción.");
    }
  }

  if (process.env.LOCAL_DEMO_MODE === "1") return false;
  return configured;
}

export function hasSupabaseAdminConfig() {
  return hasSupabaseConfig() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
