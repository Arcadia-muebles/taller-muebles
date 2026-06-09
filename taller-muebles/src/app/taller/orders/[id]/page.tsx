import { ArrowLeft, CalendarDays, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { WorkerQueue } from "@/components/worker-queue";
import { requireSession } from "@/lib/auth";
import { getOrder } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import { deliveryLabel, formatDate } from "@/lib/utils";
import { canWorkerSeeOrder } from "@/lib/workshop-access";

export default async function WorkshopOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession(["operator"]);
  const { id } = await params;
  const [order, settings] = await Promise.all([getOrder(id), getSystemSettings()]);
  if (!order || ["completed", "cancelled"].includes(order.status)) notFound();
  if (!canWorkerSeeOrder(user, order)) notFound();

  return (
    <AppShell active="taller" user={user}>
      <header className="border-b border-stone-200 pb-5">
        <Link href="/taller" className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-stone-950">
          <ArrowLeft className="size-4" />
          Volver a la cola
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-3xl font-semibold tracking-tight">{order.code}</h1>
          <StatusBadge type="order" value={order.status} />
        </div>
        <p className="mt-2 text-sm text-stone-600">{order.product} · {order.material} · {order.color}</p>
      </header>

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        <Info icon={CalendarDays} label="Entrega" value={`${formatDate(order.deliveryDate)} · ${deliveryLabel(order.deliveryDate, false)}`} />
        <Info label="Responsable" value={order.assignedTo} />
        <Info label="Cliente" value={order.client} />
      </section>

      <section className="mt-5 rounded-lg border border-stone-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <MessageSquareText className="size-4 text-stone-500" />
          <h2 className="text-sm font-semibold">Indicaciones de producción</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-stone-600">{order.observations}</p>
      </section>

      <div className="mt-5">
        <WorkerQueue
          orders={[order]}
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

function Info({ icon: Icon, label, value }: { icon?: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
        {Icon ? <Icon className="size-4" /> : null}
        {label}
      </div>
      <p className="mt-3 text-sm font-semibold text-stone-900">{value}</p>
    </div>
  );
}
