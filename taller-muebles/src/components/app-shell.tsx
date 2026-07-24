import { LogIn } from "lucide-react";
import Image from "next/image";
import { logout } from "@/app/login/actions";
import { roleLabel } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { hasSupabaseConfig } from "@/lib/env";
import type { Role } from "@/lib/types";
import { DesktopShell } from "./desktop-shell";
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
    <DesktopShell
      sidebar={(
        <div className="flex min-h-full flex-col">
          <div className="border-b border-stone-200 pb-5">
            <Image
              src={brand.logo}
              alt="La Reina · Muebles en cuero"
              width={1600}
              height={874}
              className="h-auto w-40"
              priority
              unoptimized
            />
            <p className="mt-2 text-xs font-medium text-stone-500">{brand.appName}</p>
          </div>
          {localMode ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              Sin Supabase
            </div>
          ) : null}

          <SidebarNavigation active={active} canUseAdmin={canUseAdmin} canEditAdmin={canEditAdmin} />

          <div className="mt-auto pt-5">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <p className="truncate text-sm font-semibold">{user?.name ?? "Sin sesión"}</p>
              <p className="mt-1 text-xs text-stone-500">{user ? roleLabel(user.role) : "Sin acceso"}</p>
              <form action={logout}>
                <button type="submit" className="btn btn-secondary mt-3 h-9 w-full">
                  <LogIn className="size-4" />
                  Salir
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    >
      <MobileNavigation active={active} user={user} />
      {children}
    </DesktopShell>
  );
}
