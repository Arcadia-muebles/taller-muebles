import { AppShell } from "@/components/app-shell";
import { WorkerQueue } from "@/components/worker-queue";
import { requireSession } from "@/lib/auth";
import { listOrders } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";

export default async function WorkshopPage() {
  const user = await requireSession(["operator"]);
  const [orders, settings] = await Promise.all([listOrders(), getSystemSettings()]);

  return (
    <AppShell active="taller" user={user}>
      <WorkerQueue
        orders={orders}
        user={user}
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
