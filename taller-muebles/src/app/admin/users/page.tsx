import { AppShell } from "@/components/app-shell";
import { RoleUserGroups } from "@/components/role-user-groups";
import { requireSession } from "@/lib/auth";
import { hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/env";
import { listUsers } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";

export default async function UsersPage() {
  const session = await requireSession(["admin"]);
  const [users, settings] = await Promise.all([listUsers(), getSystemSettings()]);
  const supabaseEnabled = hasSupabaseConfig();
  const accountManagementEnabled = !supabaseEnabled || hasSupabaseAdminConfig();

  return (
    <AppShell active="admin" user={session}>
      <header className="border-b border-stone-200 pb-5">
        <p className="page-kicker">Usuarios</p>
        <h1 className="page-title">Roles y responsables</h1>
        <p className="page-description max-w-2xl">
          Abre cada rol para agregar correos y asignar personas. Los trabajadores se asignan a una etapa del proceso productivo.
        </p>
      </header>

      <RoleUserGroups
        users={users}
        steps={settings.production.steps}
        currentUserId={session.id}
        supabaseEnabled={supabaseEnabled}
        disabled={!accountManagementEnabled}
      />
    </AppShell>
  );
}
