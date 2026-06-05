export function hasSupabaseConfig() {
  if (process.env.LOCAL_DEMO_MODE === "1") return false;
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function hasSupabaseAdminConfig() {
  return hasSupabaseConfig() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
