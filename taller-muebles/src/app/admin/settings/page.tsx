import { Settings2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SystemSettingsForm } from "@/components/system-settings-form";
import { requireSession } from "@/lib/auth";
import { getSystemSettings } from "@/lib/repositories/settings";

export default async function SettingsPage() {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const settings = await getSystemSettings();

  return (
    <AppShell active="admin" user={user}>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">Configuracion</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Reglas del sistema</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            Controla el funcionamiento diario, validaciones, alertas y permisos de la plataforma.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-500">
          <Settings2 className="size-4" />
          {settings.updatedAt ? `Ultima edicion por ${settings.updatedBy ?? "administrador"}` : "Configuracion inicial"}
        </div>
      </header>
      <SystemSettingsForm initialSettings={settings} canEdit={user.role === "admin"} />
    </AppShell>
  );
}
