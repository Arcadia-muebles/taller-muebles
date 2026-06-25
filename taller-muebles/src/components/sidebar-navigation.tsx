"use client";

import { Archive, BarChart3, Boxes, FileText, Home, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarNavigationProps = {
  active: "admin" | "taller";
  canUseAdmin: boolean;
  canEditAdmin: boolean;
};

const moduleLinks = [
  { href: "/admin/documents", label: "Comercial", icon: FileText },
  { href: "/admin/stock", label: "Stock", icon: Boxes },
  { href: "/admin/reports", label: "Reportes", icon: BarChart3 },
  { href: "/admin/history", label: "Historial", icon: Archive },
  { href: "/admin/users", label: "Usuarios", icon: Users, requiresEdit: true },
  { href: "/admin/settings", label: "Configuración", icon: Settings },
];

export function SidebarNavigation({ active, canUseAdmin, canEditAdmin }: SidebarNavigationProps) {
  const pathname = usePathname();
  const homeHref = active === "admin" ? "/admin" : "/taller";
  const isHome = pathname === homeHref || pathname.startsWith(`${homeHref}/orders`);

  return (
    <>
      <nav className="mt-5 border-b border-stone-200 pb-5">
        <Link
          href={homeHref}
          aria-current={isHome ? "page" : undefined}
          className={`flex items-center gap-3 rounded-md border px-3 py-3 text-sm font-medium transition ${
            isHome
              ? "border-stone-950 bg-stone-950 text-white"
              : "border-stone-200 bg-stone-50 text-stone-800 hover:border-stone-300 hover:bg-white"
          }`}
        >
          <span className={`grid size-8 shrink-0 place-items-center rounded-md shadow-sm ${isHome ? "bg-white/15 text-white" : "bg-white text-stone-700"}`}>
            <Home className="size-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold">Inicio</span>
            <span className={`block text-xs font-normal ${isHome ? "text-stone-300" : "text-stone-500"}`}>
              Panel {active === "admin" ? "administrador" : "taller"}
            </span>
          </span>
        </Link>
      </nav>

      {canUseAdmin ? (
        <div className="mt-5">
          <p className="px-3 text-xs font-medium uppercase tracking-[0.16em] text-stone-400">Módulos</p>
          <div className="mt-3 space-y-1 text-sm">
            {moduleLinks.map(({ href, label, icon: Icon, requiresEdit }) => {
              if (requiresEdit && !canEditAdmin) return null;
              const isActive = pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex h-9 items-center gap-3 rounded-md px-3 transition ${
                    isActive ? "bg-stone-950 font-medium text-white" : "text-stone-500 hover:bg-stone-100 hover:text-stone-950"
                  }`}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}
