import { AppShell } from "@/components/app-shell";
import { WorkerQueue } from "@/components/worker-queue";
import { requireSession } from "@/lib/auth";
import { listOrders, listStructureRequests } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";

export default async function WorkshopPage() {
  const user = await requireSession(["operator"]);
  const [orders, settings, structureRequests] = await Promise.all([listOrders(), getSystemSettings(), listStructureRequests()]);

  return (
    <AppShell active="taller" user={user}>
      <WorkerQueue
        orders={orders}
        user={user}
        areaLabels={Object.fromEntries(settings.production.steps.map((step) => [step.key, step.label]))}
        structureRequestStatuses={Object.fromEntries(structureRequests.map((request) => [request.orderId, request.status]))}
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
