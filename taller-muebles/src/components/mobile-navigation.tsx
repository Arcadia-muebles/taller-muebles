"use client";

import { Archive, BarChart3, Boxes, Home, LogOut, Menu, Settings, Users, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/login/actions";
import type { Role } from "@/lib/types";

export function MobileNavigation({
  active,
  user,
}: {
  active: "admin" | "taller";
  user?: { name: string; role: Role };
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const canUseAdmin = user?.role !== "operator";
  const canEditAdmin = user?.role === "admin";

  return (
    <div className="sticky top-0 z-40 -mx-4 mb-4 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
      <div className="flex items-center justify-between">
        <Link href={active === "admin" ? "/admin" : "/taller"} className="flex items-center gap-2">
          <Image src="/arcadia-icon.png" alt="" width={32} height={32} className="size-8 shrink-0 rounded-md" priority />
          <span className="text-sm font-semibold">Control Producción</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          className="grid size-10 place-items-center rounded-md border border-stone-200 bg-white text-stone-700"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open ? (
        <div className="mt-3 rounded-lg border border-stone-200 bg-white p-2 shadow-xl shadow-stone-950/5">
          <NavLink href={active === "admin" ? "/admin" : "/taller"} icon={Home} label="Inicio" active={pathname === (active === "admin" ? "/admin" : "/taller")} />
          {canUseAdmin ? (
            <>
              <NavLink href="/admin/stock" icon={Boxes} label="Stock" active={pathname.startsWith("/admin/stock")} />
              <NavLink href="/admin/reports" icon={BarChart3} label="Reportes" active={pathname.startsWith("/admin/reports")} />
              <NavLink href="/admin/history" icon={Archive} label="Historial" active={pathname.startsWith("/admin/history")} />
              {canEditAdmin ? <NavLink href="/admin/users" icon={Users} label="Usuarios" active={pathname.startsWith("/admin/users")} /> : null}
              <NavLink href="/admin/settings" icon={Settings} label="Configuración" active={pathname.startsWith("/admin/settings")} />
            </>
          ) : null}
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-stone-200 px-2 pt-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user?.name ?? "Sin sesión"}</p>
              <p className="text-xs text-stone-500">{user ? roleLabels[user.role] : "Sin acceso"}</p>
            </div>
            <form action={logout}>
              <button className="inline-flex h-9 items-center gap-2 rounded-md border border-stone-200 px-3 text-sm font-medium text-stone-700">
                <LogOut className="size-4" />
                Salir
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const roleLabels: Record<Role, string> = {
  admin: "Administrador",
  manager: "Supervisor",
  operator: "Trabajador",
  viewer: "Lectura",
};

function NavLink({ href, icon: Icon, label, active }: { href: string; icon: React.ElementType; label: string; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition ${active ? "bg-stone-950 text-white" : "text-stone-700 hover:bg-stone-100"}`}>
      <Icon className={`size-4 ${active ? "text-white" : "text-stone-500"}`} />
      {label}
    </Link>
  );
}
