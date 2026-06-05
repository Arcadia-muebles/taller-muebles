import "server-only";

import { hasSupabaseConfig } from "@/lib/env";
import { getLocalSystemSettings, saveLocalSystemSettings } from "@/lib/local-store";
import { createClient } from "@/lib/supabase/server";
import { defaultSystemSettings } from "@/lib/system-settings";
import type { Json } from "@/lib/supabase/database.types";
import type { SystemSettings } from "@/lib/types";

export async function getSystemSettings(): Promise<SystemSettings> {
  if (!hasSupabaseConfig()) return getLocalSystemSettings();

  const supabase = await createClient();
  const { data, error } = await supabase.from("system_settings").select("value, updated_at").eq("id", true).maybeSingle();
  if (error || !data) return defaultSystemSettings;
  return mergeWithDefaults(data.value, data.updated_at);
}

export async function saveSystemSettings(settings: SystemSettings) {
  if (!hasSupabaseConfig()) {
    await saveLocalSystemSettings(settings);
    return;
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    throw new Error("No fue posible validar la sesión actual.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (profileError || !profile) {
    throw new Error("No fue posible identificar el perfil que realiza el cambio.");
  }

  const { error } = await supabase.from("system_settings").upsert({
    id: true,
    value: settings as unknown as Json,
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    throw new Error(`No fue posible guardar las reglas: ${error.message}`);
  }
}

function mergeWithDefaults(value: Json, updatedAt: string): SystemSettings {
  if (!isRecord(value)) return { ...defaultSystemSettings, updatedAt };

  const general = isRecord(value.general) ? value.general as Partial<SystemSettings["general"]> : {};
  const production = isRecord(value.production) ? value.production as Partial<SystemSettings["production"]> : {};
  const orders = isRecord(value.orders) ? value.orders as Partial<SystemSettings["orders"]> : {};
  const alerts = isRecord(value.alerts) ? value.alerts as Partial<SystemSettings["alerts"]> : {};
  const permissions = isRecord(value.permissions) ? value.permissions as Partial<SystemSettings["permissions"]> : {};

  return {
    ...defaultSystemSettings,
    general: { ...defaultSystemSettings.general, ...general },
    production: {
      ...defaultSystemSettings.production,
      ...production,
      steps: Array.isArray(production.steps) ? production.steps : defaultSystemSettings.production.steps,
    },
    orders: { ...defaultSystemSettings.orders, ...orders },
    alerts: { ...defaultSystemSettings.alerts, ...alerts },
    permissions: { ...defaultSystemSettings.permissions, ...permissions },
    updatedAt,
  };
}

function isRecord(value: unknown): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
