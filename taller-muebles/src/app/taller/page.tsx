import { Clock, Factory, Route, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { WorkerQueue } from "@/components/worker-queue";
import { WorkshopIntakeForm } from "@/components/workshop-intake-form";
import { requireSession, roleLabel } from "@/lib/auth";
import { activeOrders } from "@/lib/metrics";
import { listOrders } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import { filterWorkerOrders } from "@/lib/workshop-access";

export default async function WorkshopPage() {
  const user = await requireSession(["operator"]);
  const [orders, settings] = await Promise.all([listOrders(), getSystemSettings()]);
  const active = filterWorkerOrders(user, activeOrders(orders));
  const enabledSteps = settings.production.steps.filter((step) => step.enabled);
  const accessLabel = user.area 
    ? `Etapa: ${enabledSteps.find((step) => step.key === user.area)?.label ?? user.area}` 
    : "Acceso completo a etapas";

  const countPending = active.filter((order) => order.steps.some((step) => step.status === "pending")).length;
  const countActive = active.filter((order) => order.steps.some((step) => step.status === "active")).length;
  const countBlocked = active.filter((order) => order.steps.some((step) => step.status === "blocked")).length;

  return (
    <AppShell active="taller" user={user}>
      {/* Header del Taller */}
      <header className="flex flex-col gap-4 border-b border-stone-200/50 pb-5 lg:flex-row lg:items-center lg:justify-between select-none">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9E7A5A]">
            Panel taller
          </p>
          <h1 className="mt-2 text-[32px] font-medium tracking-tight text-stone-900 font-serif leading-tight">
            Panel operativo de taller
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-stone-500 font-medium">
            Ingreso de productos, seguimiento por etapas y acciones de producción sin datos administrativos innecesarios.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 select-none">
          <div className="inline-flex h-10 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3.5 text-xs font-semibold text-stone-700 shadow-sm">
            <UserRound className="size-3.5 text-stone-400" />
            {roleLabel(user.role)}
          </div>
          <div className="inline-flex h-10 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3.5 text-xs font-semibold text-stone-700 shadow-sm">
            <Route className="size-3.5 text-stone-400" />
            {accessLabel}
          </div>
        </div>
      </header>

      {/* KPI Row (Taller) - Top Right Icon Style */}
      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {/* Por iniciar */}
        <div className="rounded-2xl border border-stone-200/60 bg-white p-5 flex flex-col justify-between shadow-sm select-none hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-stone-500">
              Por iniciar
            </p>
            <div className="grid size-8 place-items-center rounded-lg border border-blue-200/40 bg-[#EFF6FF] text-[#2563EB]">
              <Factory className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-[34px] font-serif font-bold leading-none text-stone-900">
            {countPending}
          </p>
          <p className="mt-4 text-[10px] text-stone-400 font-medium leading-none">
            Órdenes listas para dar inicio
          </p>
        </div>

        {/* En proceso */}
        <div className="rounded-2xl border border-stone-200/60 bg-white p-5 flex flex-col justify-between shadow-sm select-none hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-stone-500">
              En proceso
            </p>
            <div className="grid size-8 place-items-center rounded-lg border border-emerald-200/40 bg-emerald-50 text-emerald-600">
              <Clock className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-[34px] font-serif font-bold leading-none text-stone-900">
            {countActive}
          </p>
          <p className="mt-4 text-[10px] text-stone-400 font-medium leading-none">
            Tareas activas en este taller
          </p>
        </div>

        {/* Bloqueadas */}
        <div className="rounded-2xl border border-stone-200/60 bg-white p-5 flex flex-col justify-between shadow-sm select-none hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-stone-500">
              Bloqueadas
            </p>
            <div className="grid size-8 place-items-center rounded-lg border border-red-200/40 bg-red-50 text-red-600">
              <Clock className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-[34px] font-serif font-bold leading-none text-stone-900">
            {countBlocked}
          </p>
          <p className="mt-4 text-[10px] text-stone-400 font-medium leading-none">
            Frenadas por decisión o material
          </p>
        </div>
      </section>

      {/* Flujo Activo Section */}
      <section className="mt-6 rounded-2xl border border-stone-200/60 bg-white p-5 shadow-sm shadow-stone-100/30 select-none">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-serif font-medium text-stone-900">Flujo de producción activo</h2>
            <p className="text-xs text-stone-400 font-semibold mt-1">Las etapas salen desde configuración y se aplican a cada nuevo producto.</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-stone-600">
            {enabledSteps.map((step, index) => (
              <span key={step.key} className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50/50 px-2.5 py-1.5 text-xs">
                <span className="grid size-5 place-items-center rounded-md bg-[#F5ECE5] text-[10px] font-bold text-stone-700">{index + 1}</span>
                {step.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Grid inferior de taller */}
      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="min-w-0">
          <WorkshopIntakeForm defaultPriority={settings.orders.defaultPriority} />
        </div>
        <div className="min-w-0">
          <WorkerQueue
            orders={active}
            user={user}
            permissions={{
              canStart: settings.permissions.operatorsCanStartSteps,
              canComplete: settings.permissions.operatorsCanCompleteSteps,
              canBlock: settings.permissions.operatorsCanBlockSteps,
              requireBlockReason: settings.permissions.requireBlockReason,
            }}
          />
        </div>
      </div>
    </AppShell>
  );
}
