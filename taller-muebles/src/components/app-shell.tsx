import { Pin } from "lucide-react";
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
    <div className="min-h-screen overflow-x-hidden bg-[#faf6f0] text-stone-950 flex">
      {/* Sidebar for Desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-stone-200/80 bg-white px-4 py-5 lg:block z-25">
        {/* Brand header */}
        <div className="flex items-center justify-between border-b border-stone-200/50 pb-5">
          <div className="flex items-center gap-3 select-none">
            <div className="text-3xl font-serif font-bold text-stone-900 tracking-tighter">
              LH
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-stone-850 leading-none">Leather House</p>
              <p className="text-[10px] text-stone-400 mt-1.5 leading-none">La Reina</p>
            </div>
          </div>
          <button className="text-stone-400 hover:text-stone-600 transition p-1">
            <Pin className="size-4" />
          </button>
        </div>

        {localMode ? (
          <div className="mt-4 rounded-lg border border-amber-250/20 bg-amber-50/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-amber-800 text-center">
            Modo local de desarrollo
          </div>
        ) : null}

        {/* Sidebar Navigation Links */}
        <SidebarNavigation active={active} canUseAdmin={canUseAdmin} canEditAdmin={canEditAdmin} />

        {/* Profile and Logout Block at Bottom */}
        <div className="absolute inset-x-4 bottom-5 space-y-3">
          {/* User Card */}
          <div className="rounded-xl border border-stone-200/60 bg-white p-3.5 flex items-center justify-between shadow-sm shadow-stone-100/50 select-none">
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#4E3F35] text-sm font-bold text-white uppercase shadow-sm">
                {user?.name?.[0] ?? "U"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-stone-850 leading-tight">{user?.name ?? "Sin sesión"}</p>
                <p className="mt-0.5 text-xs text-stone-400 font-medium leading-none">{user ? roleLabel(user.role) : "Sin acceso"}</p>
              </div>
            </div>
            <svg className="size-4 text-stone-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </div>

          {/* Salir Button */}
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-stone-500 hover:text-stone-800 transition"
            >
              <svg className="size-4 text-stone-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
              </svg>
              Salir
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="min-w-0 w-full lg:pl-64 flex flex-col">
        <div className="mx-auto flex min-h-screen w-full max-w-[1500px] min-w-0 flex-col px-4 py-4 sm:px-6 lg:px-8">
          <MobileNavigation active={active} user={user} />
          {children}
        </div>
      </main>
    </div>
  );
}
