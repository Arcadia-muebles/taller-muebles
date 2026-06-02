import { ShieldCheck, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";

const roles = [
  ["Rodrigo", "Administrador", "Acceso total"],
  ["Jefe taller", "Manager", "Produccion, stock y reportes"],
  ["Operario estructura", "Operario", "Solo su proceso"],
  ["Operario costura", "Operario", "Solo su proceso"],
  ["Viewer", "Lectura", "Sin edicion"],
];

export default function UsersPage() {
  return (
    <AppShell active="admin" user={{ name: "Rodrigo", role: "Administrador" }}>
      <header className="border-b border-stone-200 pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
          Usuarios
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Roles y permisos</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          Separacion entre administracion y taller para reducir errores y proteger datos comerciales.
        </p>
      </header>

      <section className="mt-5 grid gap-3">
        {roles.map(([name, role, scope]) => (
          <article key={name} className="flex items-center justify-between gap-4 rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-stone-100">
                <UserRound className="size-5 text-stone-600" />
              </div>
              <div>
                <p className="font-semibold">{name}</p>
                <p className="text-sm text-stone-500">{scope}</p>
              </div>
            </div>
            <span className="inline-flex h-8 items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 text-xs font-medium">
              <ShieldCheck className="size-3.5" />
              {role}
            </span>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
