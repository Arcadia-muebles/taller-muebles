import { Clock, Factory, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { WorkerQueue } from "@/components/worker-queue";
import { requireSession, roleLabel } from "@/lib/auth";
import { activeOrders } from "@/lib/metrics";
import { listOrders } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";

export default async function WorkshopPage() {
  const user = await requireSession(["operator"]);
  const [orders, settings] = await Promise.all([listOrders(), getSystemSettings()]);
  const active = activeOrders(orders);

  return (
    <AppShell active="taller" user={user}>
      <header className="flex flex-col gap-4 border-b border-stone-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
            Panel taller
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
            Trabajo del dia
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            Vista enfocada para operarios: menos datos administrativos, mas claridad
            sobre que producir, que bloquear y que terminar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700">
            <UserRound className="size-4" />
            {roleLabel(user.role)}
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

      <div className="mt-5">
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
    </AppShell>
  );
}
