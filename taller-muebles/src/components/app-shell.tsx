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
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-stone-200 bg-[#fbfaf8] px-4 py-5 lg:block">
        <div className="border-b border-stone-300 pb-5">
          <div className="flex items-center gap-2">
            <span className="h-px w-7 bg-stone-950" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">Arcadia</p>
          </div>
          <div className="mt-3">
            <p className="text-[15px] font-semibold leading-tight text-stone-950">Produccion taller</p>
            <p className="mt-1 text-xs leading-5 text-stone-500">Leather House / La Reina</p>
          </div>
        </div>

        {localMode ? (
          <div className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Modo local de desarrollo
          </div>
        ) : null}

        <SidebarNavigation active={active} canUseAdmin={canUseAdmin} canEditAdmin={canEditAdmin} />

        <div className="absolute inset-x-4 bottom-5">
          <div className="border-t border-stone-300 pt-4">
            <p className="truncate text-sm font-semibold">{user?.name ?? "Sin sesion"}</p>
            <p className="mt-1 text-xs text-stone-500">{user ? roleLabel(user.role) : "Sin acceso"}</p>
            <form action={logout}>
              <button type="submit" className="btn btn-secondary mt-3 h-9 w-full bg-[#fbfaf8]">
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
