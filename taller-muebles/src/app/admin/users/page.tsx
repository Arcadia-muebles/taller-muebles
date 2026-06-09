import { ShieldCheck, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DeactivateUserButton } from "@/components/deactivate-user-button";
import { UserCreateForm } from "@/components/user-create-form";
import { requireSession, roleLabel } from "@/lib/auth";
import { hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/env";
import { listUsers } from "@/lib/repositories/production";
import type { AreaKey } from "@/lib/types";

export default async function UsersPage() {
  const session = await requireSession(["admin"]);
  const users = await listUsers();
  const supabaseEnabled = hasSupabaseConfig();
  const accountManagementEnabled = !supabaseEnabled || hasSupabaseAdminConfig();

  return (
    <AppShell active="admin" user={session}>
      <header className="border-b border-stone-200 pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
          Usuarios
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Roles y permisos</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          Separacion entre administracion y taller para reducir errores y proteger datos comerciales.
        </p>
      </header>

      <UserCreateForm supabaseEnabled={supabaseEnabled} disabled={!accountManagementEnabled} />

      <section className="mt-5 overflow-hidden rounded-lg border border-stone-200 bg-white">
        <div className="border-b border-stone-200 px-4 py-3">
          <h2 className="text-base font-semibold">Equipo y accesos</h2>
          <p className="text-sm text-stone-500">{users.filter((user) => user.active).length} usuarios activos.</p>
        </div>
        <div className="divide-y divide-stone-100">
        {users.map((user) => (
          <article key={user.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className={`grid size-10 place-items-center rounded-lg ${user.active ? "bg-stone-100" : "bg-stone-50 opacity-50"}`}>
                <UserRound className="size-5 text-stone-600" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{user.name}</p>
                  {!user.active ? <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">Inactivo</span> : null}
                </div>
                <p className="text-sm text-stone-500">{user.email.includes("@") ? user.email : "Cuenta Supabase"}{user.area ? ` · ${areaLabel(user.area)}` : ""}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 text-xs font-medium">
                <ShieldCheck className="size-3.5" />
                {roleLabel(user.role)}
              </span>
              {user.active ? <DeactivateUserButton userId={user.id} disabled={!accountManagementEnabled} /> : null}
            </div>
          </article>
        ))}
        {!users.length ? (
          <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 p-6 text-sm text-stone-500">
            No hay usuarios registrados. El primer acceso local creara un usuario automaticamente.
          </div>
        ) : null}
        </div>
      </section>
    </AppShell>
  );
}

function areaLabel(area: AreaKey) {
  const labels: Record<string, string> = {
    structure: "Estructura",
    cutting: "Corte",
    sewing: "Costura",
    upholstery: "Tapiceria",
    quality: "Revision",
  };
  return labels[area] ?? area;
}
