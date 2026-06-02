import Link from "next/link";
import { ArrowRight, ClipboardList, LayoutDashboard } from "lucide-react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-stone-100 px-4 py-6 text-stone-950">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_420px]">
        <section>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
            Sistema interno
          </p>
          <h2 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight">
            Produccion ordenada, permisos claros y trazabilidad desde el primer dia.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-stone-600">
            El acceso se organiza por rol. Rodrigo y administradores controlan la
            operacion completa; operarios entran a una vista simplificada para
            actualizar etapas sin tocar datos comerciales sensibles.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link
              href="/admin"
              className="group rounded-lg border border-stone-200 bg-white p-4 transition hover:border-stone-400"
            >
              <LayoutDashboard className="size-5 text-stone-500" />
              <p className="mt-4 text-sm font-semibold">Vista admin demo</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Ventas, produccion activa, stock, reportes y configuracion.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium">
                Abrir <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
            <Link
              href="/taller"
              className="group rounded-lg border border-stone-200 bg-white p-4 transition hover:border-stone-400"
            >
              <ClipboardList className="size-5 text-stone-500" />
              <p className="mt-4 text-sm font-semibold">Vista taller demo</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Cola diaria, filtros por proceso y acciones simples por etapa.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium">
                Abrir <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          </div>
        </section>

        <LoginForm />
      </div>
    </main>
  );
}
