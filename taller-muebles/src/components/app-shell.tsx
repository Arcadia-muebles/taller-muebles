import Link from "next/link";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  LogIn,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AppShellProps = {
  active: "admin" | "taller";
  user?: {
    name: string;
    role: string;
  };
  children: React.ReactNode;
};

const nav = [
  { href: "/admin", label: "Admin", icon: LayoutDashboard, key: "admin" },
  { href: "/taller", label: "Taller", icon: ClipboardList, key: "taller" },
];

export function AppShell({ active, user, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-stone-100 text-stone-950">
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

        <nav className="mt-5 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-stone-600 transition",
                  isActive && "bg-stone-950 text-white",
                  !isActive && "hover:bg-stone-100 hover:text-stone-950",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 border-t border-stone-200 pt-5">
          <p className="px-3 text-xs font-medium uppercase tracking-[0.16em] text-stone-400">
            Modulos
          </p>
          <div className="mt-3 space-y-1 text-sm text-stone-500">
            <Link href="/admin/stock" className="flex h-9 items-center gap-3 rounded-md px-3 hover:bg-stone-100 hover:text-stone-950">
              <Boxes className="size-4" />
              Stock
            </Link>
            <Link href="/admin/reports" className="flex h-9 items-center gap-3 rounded-md px-3 hover:bg-stone-100 hover:text-stone-950">
              <BarChart3 className="size-4" />
              Reportes
            </Link>
            <Link href="/admin/users" className="flex h-9 items-center gap-3 rounded-md px-3 hover:bg-stone-100 hover:text-stone-950">
              <Users className="size-4" />
              Usuarios
            </Link>
            <Link href="/admin/settings" className="flex h-9 items-center gap-3 rounded-md px-3 hover:bg-stone-100 hover:text-stone-950">
              <Settings className="size-4" />
              Configuracion
            </Link>
          </div>
        </div>

        <div className="absolute inset-x-4 bottom-5">
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <p className="truncate text-sm font-semibold">{user?.name ?? "Modo demo"}</p>
            <p className="mt-1 text-xs text-stone-500">{user?.role ?? "Sin sesion real"}</p>
            <Link
              href="/login"
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-stone-200 bg-white text-sm font-medium text-stone-700"
            >
              <LogIn className="size-4" />
              Acceso
            </Link>
          </div>
        </div>
      </aside>

      <main className="lg:pl-64">
        <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 py-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
