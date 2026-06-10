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
      <header className="page-header">
        <div>
          <p className="page-kicker">Configuracion</p>
          <h1 className="page-title">Reglas del sistema</h1>
          <p className="page-description max-w-2xl">
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
