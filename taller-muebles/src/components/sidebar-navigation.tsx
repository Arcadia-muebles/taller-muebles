"use client";

import { Archive, BarChart3, Boxes, Home, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarNavigationProps = {
  active: "admin" | "taller";
  canUseAdmin: boolean;
  canEditAdmin: boolean;
};

const moduleLinks = [
  { href: "/admin/stock", label: "Stock", icon: Boxes },
  { href: "/admin/reports", label: "Reportes", icon: BarChart3 },
  { href: "/admin/history", label: "Historial", icon: Archive },
  { href: "/admin/users", label: "Usuarios", icon: Users, requiresEdit: true },
  { href: "/admin/settings", label: "Configuración", icon: Settings },
];

export function SidebarNavigation({ active, canUseAdmin, canEditAdmin }: SidebarNavigationProps) {
  const pathname = usePathname();
  const homeHref = active === "admin" ? "/admin" : "/taller";
  
  // El Home es activo si estamos exactamente en /admin o /taller, o si estamos en /admin/orders/...
  const isHome = pathname === homeHref || (active === "admin" && pathname.startsWith("/admin/orders/"));

  return (
    <div className="mt-6 flex flex-col gap-1.5 select-none text-sm">
      {/* Link Inicio */}
      <Link
        href={homeHref}
        aria-current={isHome ? "page" : undefined}
        className={`flex items-center gap-3.5 rounded-xl px-4 py-3 transition-all duration-200 ${
          isHome
            ? "bg-[#F5ECE5] text-[#2E2520] font-bold"
            : "text-stone-600 hover:bg-stone-50 hover:text-stone-900 font-medium"
        }`}
      >
        <div
          className={`grid size-9 shrink-0 place-items-center rounded-lg transition-colors ${
            isHome ? "bg-white text-[#2E2520] border border-stone-200/30 shadow-sm" : "bg-stone-50 text-stone-500 border border-stone-100"
          }`}
        >
          <Home className="size-4.5" />
        </div>
        <div className="min-w-0">
          <span className="block text-sm leading-tight">Inicio</span>
          <span
            className={`block text-[9px] font-bold uppercase tracking-wider mt-0.5 ${
              isHome ? "text-[#9E7A5A]" : "text-stone-400"
            }`}
          >
            Panel {active === "admin" ? "administrador" : "taller"}
          </span>
        </div>
      </Link>

      {/* Links de Módulos (solo para administradores) */}
      {canUseAdmin && (
        <div className="mt-2 flex flex-col gap-1.5">
          {moduleLinks.map(({ href, label, icon: Icon, requiresEdit }) => {
            if (requiresEdit && !canEditAdmin) return null;

            const isActive = pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3.5 rounded-xl px-4 py-3 transition-all duration-200 ${
                  isActive
                    ? "bg-[#F5ECE5] text-[#2E2520] font-bold"
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900 font-medium"
                }`}
              >
                <div
                  className={`grid size-9 shrink-0 place-items-center rounded-lg transition-colors ${
                    isActive ? "bg-white text-[#2E2520] border border-stone-200/30 shadow-sm" : "bg-stone-50 text-stone-500 border border-stone-100"
                  }`}
                >
                  <Icon className="size-4.5" />
                </div>
                <span className="block text-sm leading-tight">{label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

