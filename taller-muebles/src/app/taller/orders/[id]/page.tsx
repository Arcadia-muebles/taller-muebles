import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Clock,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OrderCollaboration } from "@/components/order-collaboration";
import { OrderLabelPrintButton } from "@/components/order-label-print-button";
import { StatusBadge } from "@/components/status-badge";
import { WorkshopOrderActionPanel } from "@/components/workshop-order-action-panel";
import { requireSession } from "@/lib/auth";
import { completionPercent } from "@/lib/metrics";
import {
  getOrder,
  listOrders,
  listOrderAttachments,
  listOrderAudit,
  listOrderComments,
} from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import type { ProductionStep, StepStatus } from "@/lib/types";
import { deliveryLabel, durationLabel, formatDate, formatDateTime, priorityLabel } from "@/lib/utils";
import { canWorkerSeeOrder, filterWorkerFutureOrders, nextWorkStep, workerActionStep } from "@/lib/workshop-access";

export default async function WorkshopOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession(["operator"]);
  const { id } = await params;
  const [order, audit, comments, attachments, settings, orders] = await Promise.all([
    getOrder(id),
    listOrderAudit(id),
    listOrderComments(id),
    listOrderAttachments(id),
    getSystemSettings(),
    listOrders(),
  ]);
  if (!order || order.status === "cancelled") notFound();
  if (!canWorkerSeeOrder(user, order) && !filterWorkerFutureOrders(user, [order]).length) notFound();

  const progress = completionPercent(order);
  const groupOrders = orders.filter((item) => item.status !== "cancelled" && item.groupCode === order.groupCode);
  const actionStep = workerActionStep(user, order);
  const currentStep = nextWorkStep(order);
  const visibleAudit = audit.slice(0, 5);

  return (
    <AppShell active="taller" user={user}>
      <div className="mx-auto w-full min-w-0 max-w-5xl pb-20 lg:pb-0">
      <header className="border-b border-stone-200 pb-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="/taller" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-stone-500 hover:text-stone-950">
            <ArrowLeft className="size-4" />
            Cola
          </Link>
          <OrderLabelPrintButton order={order} groupOrders={groupOrders} className="h-10 justify-center px-3" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="mr-1 font-mono text-3xl font-semibold tracking-tight text-stone-950">{order.code}</h1>
          <StatusBadge type="order" value={order.status} />
          {order.isWarranty ? <WarrantyPill /> : null}
        </div>
        <p className="mt-2 line-clamp-2 text-sm font-semibold uppercase leading-5 text-stone-800">{order.product}</p>
        <p className="mt-1 truncate text-sm text-stone-500">{order.material} · {order.color || "Sin color"}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <TopMetric icon={CalendarDays} label="Entrega" value={formatDate(order.deliveryDate)} helper={deliveryLabel(order.deliveryDate, false)} />
          <TopMetric label="Urgencia" value={priorityLabel(order.priority)} helper={currentStep ? `Ahora: ${currentStep.label}` : "Sin etapa"} />
          <TopMetric label="Cliente" value={order.client} helper="Cliente" />
          <TopMetric label="Avance" value={`${progress}%`} helper="Completado" />
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="grid gap-4">
          <WorkshopOrderActionPanel
            orderId={order.id}
            orderCode={order.code}
            step={actionStep ? {
              key: actionStep.key,
              label: actionStep.label,
              status: actionStep.status,
              notes: actionStep.notes,
            } : undefined}
            canStart={settings.permissions.operatorsCanStartSteps}
            canComplete={settings.permissions.operatorsCanCompleteSteps}
            canBlock={settings.permissions.operatorsCanBlockSteps}
            canReopen={!isFinalDeliveryStep(order.steps, order.steps.findIndex((step) => step.key === actionStep?.key))}
            requireBlockReason={settings.permissions.requireBlockReason}
          />

          <section className="rounded-lg border border-stone-200 bg-white p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <MessageSquareText className="size-4 text-stone-500" />
              <h2 className="text-sm font-semibold text-stone-950">Indicaciones</h2>
            </div>
            <p className="mt-2 line-clamp-4 text-sm leading-6 text-stone-600">{order.observations}</p>
          </section>
        </div>

        <aside className="grid gap-3">
          <section className="rounded-lg border border-stone-200 bg-white p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Flujo</p>
                <h2 className="mt-1 text-sm font-semibold text-stone-950">{currentStep ? currentStep.label : "Sin etapa activa"}</h2>
              </div>
              <Clock className="size-5 shrink-0 text-stone-500" />
            </div>
            <StepRail steps={order.steps} />
          </section>

          <Disclosure title="Datos" description="Información completa del pedido.">
            <div className="grid gap-2">
              <Row label="Producto" value={order.product} />
              <Row label="Material" value={order.material} />
              <Row label="Color" value={order.color || "Sin color"} />
              <Row label="Tienda" value={order.store === "LR" ? "La Reina" : "Leather House"} />
              <Row label="Ingreso" value={formatDate(order.entryDate)} />
              <Row label="Condición" value={conditionLabel(order.condition)} />
              <Row label="Responsable" value={order.assignedTo} />
              <Row label="Pedido" value={order.groupCode} />
            </div>
          </Disclosure>

          <Disclosure title="Etapas" description="Fechas y responsables por proceso.">
            <div className="grid gap-2">
              {order.steps.map((step, index) => (
                <StepRow key={step.key} step={step} index={index} />
              ))}
            </div>
          </Disclosure>

          <Disclosure title="Actividad" description={`${audit.length} registros visibles.`}>
            <div className="grid gap-3">
              {visibleAudit.map((entry) => (
                <div key={entry.id} className="border-l-2 border-stone-200 pl-3">
                  <p className="text-sm font-medium text-stone-800">{auditActionLabel(entry.action)}</p>
                  <p className="mt-0.5 text-xs leading-5 text-stone-500">{entry.summary}</p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">
                    {formatDateTime(entry.createdAt)}
                  </p>
                </div>
              ))}
              {!audit.length ? <p className="text-sm text-stone-500">Aún no hay actividad registrada.</p> : null}
            </div>
          </Disclosure>

          <Disclosure title="Comunicación" description={`${comments.length} notas y ${attachments.length} archivos.`}>
            <OrderCollaboration orderId={order.id} comments={comments} attachments={attachments} canComment canUpload />
          </Disclosure>
        </aside>
      </section>
      </div>
    </AppShell>
  );
}

function TopMetric({ icon: Icon, label, value, helper }: { icon?: React.ElementType; label: string; value: string; helper: string }) {
  return (
    <div className="min-w-0 rounded-md border border-stone-200 bg-white px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">
        {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-stone-950">{value}</p>
      <p className="mt-0.5 truncate text-xs text-stone-500">{helper}</p>
    </div>
  );
}

function StepRail({ steps }: { steps: ProductionStep[] }) {
  return (
    <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-1">
      {steps.map((step, index) => (
        <div key={step.key} className="flex min-w-14 flex-1 items-center gap-1">
          <div className="grid min-w-0 flex-1 gap-1">
            <div className={`h-2 rounded-full ${stepTone(step.status)}`} />
            <p className="truncate text-center text-[11px] font-semibold text-stone-500">{shortStepLabel(step.label, index)}</p>
          </div>
          {index < steps.length - 1 ? <div className="h-px w-3 shrink-0 bg-stone-200" /> : null}
        </div>
      ))}
    </div>
  );
}

function Disclosure({ title, description, defaultOpen, children }: { title: string; description: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details className="rounded-lg border border-stone-200 bg-white" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 sm:p-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-stone-950">{title}</h2>
          <p className="mt-0.5 truncate text-xs text-stone-500">{description}</p>
        </div>
        <ChevronDown className="size-4 shrink-0 text-stone-500" />
      </summary>
      <div className="border-t border-stone-200 p-3 sm:p-4">
        {children}
      </div>
    </details>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md bg-stone-50 px-3 py-2">
      <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="min-w-0 truncate text-right text-sm font-semibold text-stone-950">{value}</p>
    </div>
  );
}

function StepRow({ step, index }: { step: ProductionStep; index: number }) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-950">{index + 1}. {step.label}</p>
          <p className="mt-0.5 truncate text-xs text-stone-500">{step.owner}</p>
        </div>
        <StatusBadge type="step" value={step.status} className="shrink-0" />
      </div>
      <p className="mt-2 text-xs text-stone-500">
        Inicio: {formatDateTime(step.startedAt)} · Término: {formatDateTime(step.completedAt)} · {durationLabel(step.startedAt, step.completedAt)}
      </p>
      {step.notes ? (
        <p className="mt-2 rounded-md bg-white px-2.5 py-2 text-xs font-medium text-stone-700">{step.notes}</p>
      ) : null}
    </div>
  );
}

function WarrantyPill() {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 text-xs font-medium text-stone-700">
      <ShieldCheck className="size-3.5" />
      Garantía
    </span>
  );
}

function stepTone(status: StepStatus) {
  const tones: Record<StepStatus, string> = {
    pending: "bg-stone-200",
    active: "bg-blue-500",
    done: "bg-emerald-500",
    blocked: "bg-rose-500",
  };
  return tones[status];
}

function shortStepLabel(label: string, index: number) {
  const normalized = label.toLowerCase();
  if (normalized.includes("estructura")) return "Est";
  if (normalized.includes("blanco")) return "Bla";
  if (normalized.includes("corte")) return "Cor";
  if (normalized.includes("costura")) return "Cos";
  if (normalized.includes("tapicer")) return "Tap";
  if (normalized.includes("calidad")) return "Cal";
  if (normalized.includes("termin") || normalized.includes("despacho")) return "Ter";
  return String(index + 1);
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

function isFinalDeliveryStep(steps: ProductionStep[], stepIndex: number) {
  const step = steps[stepIndex];
  return stepIndex === steps.length - 1 && Boolean(step && /dispatch|despacho|entrega|terminado/i.test(`${step.key} ${step.label}`));
}

function conditionLabel(condition: string) {
  if (condition === "Sin condicion") return "Sin condición";
  if (condition === "En exhibicion") return "En exhibición";
  return condition;
}
