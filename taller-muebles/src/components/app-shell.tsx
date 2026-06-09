import { LogIn } from "lucide-react";
import { logout } from "@/app/login/actions";
import { roleLabel } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import type { Role } from "@/lib/types";
import { MobileNavigation } from "./mobile-navigation";
import { SidebarNavigation } from "./sidebar-navigation";

type AppShellProps = {
  active: "admin" | "taller";
  user?: {
    name: string;
    role: Role;
  };
  children: React.ReactNode;
};

export function AppShell({ active, user, children }: AppShellProps) {
  const canUseAdmin = user?.role !== "operator";
  const canEditAdmin = user?.role === "admin";
  const localMode = !hasSupabaseConfig();
  return (
    <div className="min-h-screen overflow-x-hidden bg-stone-100 text-stone-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-stone-200 bg-white px-4 py-5 lg:block">
        <div className="flex items-center gap-3 border-b border-stone-200 pb-5">
          <div className="grid size-10 place-items-center rounded-lg bg-stone-950 text-sm font-semibold text-white">
            LH
          </div>
          <div>
            <p className="text-sm font-semibold">Control Produccion</p>
            <p className="text-xs text-stone-500">Leather House / La Reina</p>
          </div>
        </div>
        {localMode ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Modo local de desarrollo
          </div>
        ) : null}

        <SidebarNavigation active={active} canUseAdmin={canUseAdmin} canEditAdmin={canEditAdmin} />

        <div className="absolute inset-x-4 bottom-5">
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <p className="truncate text-sm font-semibold">{user?.name ?? "Sin sesion"}</p>
            <p className="mt-1 text-xs text-stone-500">{user ? roleLabel(user.role) : "Sin acceso"}</p>
            <form action={logout}>
              <button
                type="submit"
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-stone-200 bg-white text-sm font-medium text-stone-700"
              >
                <LogIn className="size-4" />
                Salir
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="min-w-0 lg:pl-64">
        <div className="mx-auto flex min-h-screen w-full max-w-[1500px] min-w-0 flex-col px-4 py-4 sm:px-6 lg:px-8">
          <MobileNavigation active={active} user={user} />
          {children}
        </div>
      </main>
    </div>
  );
}
