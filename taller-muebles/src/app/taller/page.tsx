import { Route, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { WorkerQueue } from "@/components/worker-queue";
import { requireSession, roleLabel } from "@/lib/auth";
import { listOrders } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import { filterWorkerOrders, workerAreas } from "@/lib/workshop-access";

export default async function WorkshopPage() {
  const user = await requireSession(["operator"]);
  const [orders, settings] = await Promise.all([listOrders(), getSystemSettings()]);
  const visibleOrders = filterWorkerOrders(
    user,
    orders.filter((order) => order.status !== "cancelled"),
  );
  const stepLabel = workerAreas(user)
    .map((area) => settings.production.steps.find((step) => step.key === area)?.label ?? area)
    .join(", ") || "Sin etapa asignada";

  return (
    <AppShell active="taller" user={user}>
      <header className="page-header">
        <div>
          <p className="page-kicker">Taller</p>
          <h1 className="page-title">Trabajo asignado</h1>
          <p className="page-description max-w-2xl">
            Marca cuando empiezas y terminas tu etapa. Cada movimiento queda registrado con hora.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="btn btn-secondary">
            <UserRound className="size-4" />
            {roleLabel(user.role)}
          </div>
          <div className="btn btn-secondary">
            <Route className="size-4" />
            {stepLabel}
          </div>
        </div>
      </header>

      <div className="mt-5">
        <WorkerQueue
          orders={visibleOrders}
          user={user}
          areaLabels={Object.fromEntries(settings.production.steps.map((step) => [step.key, step.label]))}
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
