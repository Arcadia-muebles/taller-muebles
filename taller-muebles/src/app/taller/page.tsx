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
  const accessLabel = user.area ? `Etapa asignada: ${enabledSteps.find((step) => step.key === user.area)?.label ?? user.area}` : "Acceso completo a todas las etapas";

  return (
    <AppShell active="taller" user={user}>
      <header className="flex flex-col gap-4 border-b border-stone-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
            Panel taller
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
            Panel operativo de taller
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            Ingreso de productos, seguimiento por etapas y acciones de produccion sin datos administrativos innecesarios.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700">
            <UserRound className="size-4" />
            {roleLabel(user.role)}
          </div>
          <div className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700">
            <Route className="size-4" />
            {accessLabel}
          </div>
        </div>
      </header>

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-700/70">
              Por iniciar
            </p>
            <Factory className="size-4 text-blue-700" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-blue-950">
            {active.filter((order) => order.steps.some((step) => step.status === "pending")).length}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-700/70">
              En proceso
            </p>
            <Clock className="size-4 text-emerald-700" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-emerald-950">
            {active.filter((order) => order.steps.some((step) => step.status === "active")).length}
          </p>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-rose-700/70">
              Bloqueadas
            </p>
            <Clock className="size-4 text-rose-700" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-rose-950">
            {active.filter((order) => order.steps.some((step) => step.status === "blocked")).length}
          </p>
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-stone-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold">Flujo activo</h2>
            <p className="mt-1 text-sm text-stone-500">Las etapas salen desde configuracion y se aplican a cada nuevo producto.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {enabledSteps.map((step, index) => (
              <span key={step.key} className="inline-flex h-8 items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-2.5 text-xs font-medium text-stone-700">
                <span className="grid size-5 place-items-center rounded bg-white text-[11px] text-stone-500">{index + 1}</span>
                {step.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
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
