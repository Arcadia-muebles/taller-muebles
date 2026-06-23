import {
  ArrowLeft,
  CalendarDays,
  Clock,
  FileText,
  History,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OrderCollaboration } from "@/components/order-collaboration";
import { OrderLabelPrintButton } from "@/components/order-label-print-button";
import { StatusBadge } from "@/components/status-badge";
import { WorkerQueue } from "@/components/worker-queue";
import { requireSession } from "@/lib/auth";
import { completionPercent } from "@/lib/metrics";
import {
  getOrder,
  listOrders,
  listOrderAttachments,
  listOrderAudit,
} from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import { deliveryLabel, durationLabel, formatDate, formatDateTime, priorityLabel } from "@/lib/utils";
import { canWorkerSeeOrder, filterWorkerFutureOrders } from "@/lib/workshop-access";

export default async function WorkshopOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession(["operator"]);
  const { id } = await params;
  const [order, audit, attachments, settings, orders] = await Promise.all([
    getOrder(id),
    listOrderAudit(id),
    listOrderAttachments(id),
    getSystemSettings(),
    listOrders(),
  ]);
  if (!order || order.status === "cancelled") notFound();
  if (!canWorkerSeeOrder(user, order) && !filterWorkerFutureOrders(user, [order]).length) notFound();

  const progress = completionPercent(order);
  const groupOrders = orders.filter((item) => item.status !== "cancelled" && item.groupCode === order.groupCode);

  return (
    <AppShell active="taller" user={user}>
      <header className="flex flex-col gap-4 border-b border-stone-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link href="/taller" className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-stone-950">
            <ArrowLeft className="size-4" />
            Volver a la cola
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-3xl font-semibold tracking-tight">{order.code}</h1>
            <StatusBadge type="order" value={order.status} />
            {order.isWarranty ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 text-xs font-medium text-stone-700">
                <ShieldCheck className="size-3.5" />
                Garantía
              </span>
            ) : null}
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
            {order.product} · {order.material} · {order.color}
          </p>
        </div>
        <div className="flex flex-col gap-2 lg:w-72">
          <OrderLabelPrintButton order={order} groupOrders={groupOrders} className="w-full justify-center" />
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">Avance</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-sm font-semibold text-stone-900">{progress}% completado</p>
          </div>
        </div>
      </header>

      <section className="mt-5 grid gap-3 md:grid-cols-4">
        <Info icon={CalendarDays} label="Entrega" value={`${formatDate(order.deliveryDate)} · ${deliveryLabel(order.deliveryDate, false)}`} />
        <Info label="Urgencia" value={priorityLabel(order.priority)} />
        <Info label="Cliente" value={order.client} />
        <Info label="Responsable" value={order.assignedTo} />
      </section>

      <section className="mt-5 rounded-lg border border-stone-200 bg-white">
        <div className="flex items-center gap-3 border-b border-stone-200 p-4">
          <FileText className="size-5 text-stone-500" />
          <div>
            <h2 className="text-base font-semibold">Datos para producción</h2>
            <p className="text-sm text-stone-500">Información necesaria para ejecutar el trabajo.</p>
          </div>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <Info label="Producto" value={order.product} />
          <Info label="Pedido" value={order.groupCode} />
          <Info label="Material" value={order.material} />
          <Info label="Color" value={order.color} />
          <Info label="Tienda" value={order.store} />
          <Info label="Ingreso" value={formatDate(order.entryDate)} />
          <Info label="Condición" value={order.condition} />
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-stone-200 bg-white">
        <div className="flex items-center gap-3 border-b border-stone-200 p-4">
          <Clock className="size-5 text-stone-500" />
          <div>
            <h2 className="text-base font-semibold">Etapas productivas</h2>
            <p className="text-sm text-stone-500">Estado completo del mueble en taller.</p>
          </div>
        </div>
        <div className="space-y-3 p-4">
          {order.steps.map((step, index) => (
            <div
              key={step.key}
              className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="grid size-8 shrink-0 place-items-center rounded-md bg-white text-sm font-semibold text-stone-700">
                  {index + 1}
                </div>
                <div>
                  <p className="font-semibold">{step.label}</p>
                  <p className="mt-1 text-sm text-stone-500">{step.owner}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    Inicio: {formatDateTime(step.startedAt)} · Término: {formatDateTime(step.completedAt)}
                  </p>
                  {step.notes ? (
                    <p className="mt-2 max-w-xl rounded-md border border-stone-200 bg-white px-2.5 py-2 text-xs font-medium text-stone-700">
                      {step.notes}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge type="step" value={step.status} />
                <p className="text-xs text-stone-500">
                  {durationLabel(step.startedAt, step.completedAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
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
          areaLabels={Object.fromEntries(settings.production.steps.map((step) => [step.key, step.label]))}
          permissions={{
            canStart: settings.permissions.operatorsCanStartSteps,
            canComplete: settings.permissions.operatorsCanCompleteSteps,
            canBlock: settings.permissions.operatorsCanBlockSteps,
            requireBlockReason: settings.permissions.requireBlockReason,
          }}
        />
      </div>

      <section className="mt-5 rounded-lg border border-stone-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <History className="size-5 text-stone-500" />
          <div>
            <h2 className="text-base font-semibold">Actividad reciente</h2>
            <p className="text-sm text-stone-500">Cambios y registros visibles para taller.</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {audit.slice(0, 10).map((entry) => (
            <div key={entry.id} className="border-l-2 border-stone-200 pl-3">
              <p className="text-sm font-medium text-stone-800">{auditActionLabel(entry.action)}</p>
              <p className="mt-0.5 text-xs leading-5 text-stone-500">{entry.summary}</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">
                {new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}
              </p>
            </div>
          ))}
          {!audit.length ? <p className="text-sm text-stone-500">Aún no hay actividad registrada.</p> : null}
        </div>
      </section>

      <div className="mt-5">
        <OrderCollaboration
          orderId={order.id}
          attachments={attachments}
          canUpload
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

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    create_order: "Orden creada",
    create_workshop_order: "Ingreso desde taller",
    update_order: "Orden actualizada",
    update_step: "Etapa actualizada",
    revert_step: "Cambio de etapa revertido",
    comment_step: "Comentario de etapa",
    add_comment: "Comentario agregado",
    add_attachment: "Adjunto agregado",
    close_order: "Orden cerrada",
    cancel_order: "Orden cancelada",
  };
  return labels[action] ?? action;
}
