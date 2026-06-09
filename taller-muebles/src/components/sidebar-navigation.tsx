"use client";

import { Archive, BarChart3, Boxes, Home, Settings, Users, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarNavigationProps = {
  active: "admin" | "taller";
  canUseAdmin: boolean;
  canEditAdmin: boolean;
};

const moduleLinks = [
  { href: "/admin/stock", label: "Stock", icon: Boxes },
  { href: "/admin", label: "Producción", icon: ClipboardCheck },
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
      <nav className="mt-5 border-b border-stone-200/50 pb-5 select-none">
        <Link
          href={homeHref}
          aria-current={isHome ? "page" : undefined}
          className={`flex items-center gap-3.5 rounded-xl border px-4 py-3 text-sm transition-all duration-200 ${
            isHome
              ? "border-stone-900 bg-[#4E3F35] text-white shadow-md shadow-stone-900/10 font-semibold"
              : "border-stone-200/80 bg-stone-50/50 text-stone-700 hover:bg-stone-100 hover:border-stone-300"
          }`}
        >
          <div
            className={`grid size-9 shrink-0 place-items-center rounded-lg shadow-inner transition-colors ${
              isHome ? "bg-white/10 text-white" : "bg-white text-stone-600 border border-stone-100"
            }`}
          >
            <Home className="size-4.5" />
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-bold leading-tight">Inicio</span>
            <span
              className={`block text-[10px] font-medium uppercase tracking-wider mt-0.5 ${
                isHome ? "text-stone-300" : "text-stone-400"
              }`}
            >
              Panel {active === "admin" ? "administrador" : "taller"}
            </span>
          </div>
        </Link>
      </nav>

      {canUseAdmin ? (
        <div className="mt-5 select-none">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9E7A5A]">
            Módulos
          </p>
          <div className="mt-3 space-y-0.5 text-sm">
            {moduleLinks.map(({ href, label, icon: Icon, requiresEdit }) => {
              if (requiresEdit && !canEditAdmin) return null;
              
              // Evitar que /admin marque como activa la ruta de producción si estamos en otra subruta
              const isActive = href === "/admin" 
                ? pathname === "/admin" 
                : pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex h-10 items-center gap-3 rounded-lg px-3 transition-colors ${
                    isActive
                      ? "bg-[#FAF6F0] text-stone-950 font-bold border-l-2 border-[#9E7A5A] rounded-l-none"
                      : "text-stone-550 hover:bg-stone-50 hover:text-stone-950 font-medium"
                  }`}
                >
                  <Icon className={`size-4 ${isActive ? "text-[#9E7A5A]" : "text-stone-450"}`} />
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
