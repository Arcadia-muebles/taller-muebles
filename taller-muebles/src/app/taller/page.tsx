import { AppShell } from "@/components/app-shell";
import { WorkerQueue } from "@/components/worker-queue";
import { requireSession } from "@/lib/auth";
import { listWorkshopOrders } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import { canWorkerSeeOrder, filterWorkerFutureOrders } from "@/lib/workshop-access";

export default async function WorkshopPage() {
  const user = await requireSession(["operator"]);
  const [orders, settings] = await Promise.all([listWorkshopOrders(), getSystemSettings()]);
  const workshopUser = { ...user, allowParallelSteps: settings.production.allowParallelSteps };
  const futureIds = new Set(filterWorkerFutureOrders(workshopUser, orders).map((order) => order.id));
  const visibleOrders = orders.filter((order) => canWorkerSeeOrder(workshopUser, order) || futureIds.has(order.id));

  return (
    <AppShell active="taller" user={user}>
      <WorkerQueue
        orders={visibleOrders}
        user={workshopUser}
        areaLabels={Object.fromEntries(settings.production.steps.map((step) => [step.key, step.label]))}
        permissions={{
          canStart: settings.permissions.operatorsCanStartSteps,
          canComplete: settings.permissions.operatorsCanCompleteSteps,
          canBlock: settings.permissions.operatorsCanBlockSteps,
          requireBlockReason: settings.permissions.requireBlockReason,
        }}
      />
    </AppShell>
  );
}
