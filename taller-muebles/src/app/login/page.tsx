import { ClipboardList, LayoutDashboard } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { hasSupabaseConfig } from "@/lib/env";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-stone-100 px-4 py-6 text-stone-950">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_420px]">
        <section className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
            Sistema interno
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Produccion ordenada, permisos claros y trazabilidad desde el primer dia.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-stone-600">
            El acceso se organiza por rol. Rodrigo y administradores controlan la
            operacion completa; operarios entran a una vista simplificada para
            actualizar etapas sin tocar datos comerciales sensibles.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <LayoutDashboard className="size-5 text-stone-500" />
              <p className="mt-4 text-sm font-semibold">Panel administrador</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Ventas, produccion activa, stock, reportes y configuracion.
              </p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <ClipboardList className="size-5 text-stone-500" />
              <p className="mt-4 text-sm font-semibold">Panel taller</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Cola diaria, filtros por proceso y acciones simples por etapa.
              </p>
            </div>
          </div>
        </section>

        <LoginForm supabaseEnabled={hasSupabaseConfig()} />
      </div>
    </main>
  );
}
