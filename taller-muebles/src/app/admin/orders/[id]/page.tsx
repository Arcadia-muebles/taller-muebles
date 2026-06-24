import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  FileText,
  History,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { OrderActions } from "@/components/order-actions";
import { OrderCollaboration } from "@/components/order-collaboration";
import { OrderLabelPrintButton } from "@/components/order-label-print-button";
import { ProductionStepControls } from "@/components/production-step-controls";
import { StepCommentButton } from "@/components/step-comment-button";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth";
import { completionPercent } from "@/lib/metrics";
import { getSystemSettings } from "@/lib/repositories/settings";
import { getOrder, listOrderAttachments, listOrderAudit, listOrders } from "@/lib/repositories/production";
import { deliveryLabel, durationLabel, formatDate, formatDateTime, priorityLabel } from "@/lib/utils";

type OrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const { id } = await params;
  const [order, audit, attachments, settings, orders] = await Promise.all([
    getOrder(id),
    listOrderAudit(id),
    listOrderAttachments(id),
    getSystemSettings(),
    listOrders(),
  ]);

  if (!order) {
    notFound();
  }

  const progress = completionPercent(order);
  const canEditOrder = user.role === "admin" || (user.role === "manager" && settings.permissions.managersCanEditOrders);
  const canCommentOnSteps = user.role === "admin" || user.role === "manager";
  const canClose = order.steps.every((step) => step.status === "done");
  const groupOrders = orders.filter((item) => item.groupCode === order.groupCode);

  return (
    <AppShell active="admin" user={user}>
      <header className="flex flex-col gap-4 border-b border-stone-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-stone-950"
          >
            <ArrowLeft className="size-4" />
            Volver al panel
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-stone-950">
              {order.code}
            </h1>
            <StatusBadge type="order" value={order.status} />
            {order.isWarranty ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 text-xs font-medium text-stone-700">
                <ShieldCheck className="size-3.5" />
                Garantía
              </span>
            ) : null}
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
            Seguimiento completo de venta, producción, observaciones y estado de
            entrega para {order.client}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <OrderLabelPrintButton order={order} groupOrders={groupOrders} />
          {canEditOrder ? <OrderActions orderId={order.id} canClose={canClose} /> : null}
        </div>
      </header>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="rounded-lg border border-stone-200 bg-white">
            <div className="flex items-center gap-3 border-b border-stone-200 p-4">
              <FileText className="size-5 text-stone-500" />
              <div>
                <h2 className="text-base font-semibold">Datos de la orden</h2>
                <p className="text-sm text-stone-500">Información comercial y productiva.</p>
              </div>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <Info label="Cliente" value={order.client} />
              <Info label="Tienda" value={order.store} />
              <Info label="Documento" value={documentTypeLabel(order.documentType)} />
              <Info label="Estado doc." value={documentStatusLabel(order.documentStatus)} />
              <Info label="Pedido común" value={order.groupCode} />
              {order.customerContact ? <Info label="Contacto / RUT" value={order.customerContact} /> : null}
              <Info label="Producto" value={order.product} />
              <Info label="Material" value={order.material} />
              <Info label="Color" value={order.color} />
              {order.quantity ? <Info label="Cantidad" value={String(order.quantity)} /> : null}
              {order.unitPrice !== undefined ? <Info label="Precio unit." value={formatCurrency(order.unitPrice)} /> : null}
              <Info label="Responsable" value={order.assignedTo} />
              <Info label="Condicion" value={order.condition} />
              <Info label="Urgencia por fecha" value={priorityLabel(order.priority)} />
            </div>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white">
            <div className="flex items-center gap-3 border-b border-stone-200 p-4">
              <Clock className="size-5 text-stone-500" />
              <div>
                <h2 className="text-base font-semibold">Etapas productivas</h2>
                <p className="text-sm text-stone-500">Cada cambio quedará auditado al conectar Supabase.</p>
              </div>
            </div>
            <div className="p-4">
              <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-sm font-medium text-stone-600">{progress}% de avance</p>

              <div className="mt-5 space-y-3">
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
                      {canCommentOnSteps ? (
                        <StepCommentButton
                          orderId={order.id}
                          stepKey={step.key}
                          stepLabel={step.label}
                          initialComment={step.notes}
                        />
                      ) : null}
                      <StatusBadge type="step" value={step.status} />
                      <p className="text-xs text-stone-500">
                        {durationLabel(step.startedAt, step.completedAt)}
                      </p>
                      {canEditOrder ? (
                        <ProductionStepControls
                          orderId={order.id}
                          stepKey={step.key}
                          status={step.status}
                          canActivate={
                            settings.production.allowParallelSteps ||
                            order.steps.slice(0, index).every((previousStep) => previousStep.status === "done")
                          }
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="size-5 text-stone-500" />
              <div>
                <h2 className="text-base font-semibold">Fechas</h2>
                <p className="text-sm text-stone-500">Compromisos de entrega.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <Info label="Ingreso" value={formatDate(order.entryDate)} />
              <Info label="Entrega" value={formatDate(order.deliveryDate)} />
              <Info label="Plazo" value={deliveryLabel(order.deliveryDate, order.status === "completed")} strong />
            </div>
          </section>

          {order.documentType !== "production_intake" ? (
            <section className="rounded-lg border border-stone-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <FileText className="size-5 text-stone-500" />
                <div>
                  <h2 className="text-base font-semibold">Valores</h2>
                  <p className="text-sm text-stone-500">Resumen comercial del documento.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                <Info label="Subtotal" value={formatCurrency(order.subtotal)} />
                <Info label="Descuento" value={formatCurrency(order.discount)} />
                <Info label="Total" value={formatCurrency(order.total)} strong />
                <Info label="Abono" value={formatCurrency(order.paidAmount)} />
                <Info label="Saldo" value={formatCurrency(order.balance)} strong />
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <History className="size-5 text-stone-500" />
              <div>
                <h2 className="text-base font-semibold">Actividad reciente</h2>
                <p className="text-sm text-stone-500">Cambios relevantes de esta orden.</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {audit.slice(0, 8).map((entry) => (
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

          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <MessageSquareText className="size-5 text-stone-500" />
              <div>
                <h2 className="text-base font-semibold">Observaciones</h2>
                <p className="text-sm text-stone-500">Contexto operativo.</p>
              </div>
            </div>
            <p className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3 text-sm leading-6 text-stone-700">
              {order.observations}
            </p>
          </section>

        </aside>
      </section>

      <div className="mt-5">
        <OrderCollaboration
          orderId={order.id}
          attachments={attachments}
          canUpload={canEditOrder}
        />
      </div>
    </AppShell>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">{label}</p>
      <p className={`mt-1 text-sm ${strong ? "font-semibold text-rose-600" : "font-medium text-stone-900"}`}>
        {value}
      </p>
    </div>
  );
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    create_order: "Orden creada",
    update_order: "Orden actualizada",
    update_step: "Etapa actualizada",
    comment_step: "Comentario de etapa",
    revert_step: "Cambio de etapa revertido",
    close_order: "Orden cerrada",
    cancel_order: "Orden cancelada",
  };
  return labels[action] ?? action;
}

function documentTypeLabel(type: string) {
  const labels: Record<string, string> = {
    sales_note: "Nota de Venta",
    quote: "Cotizacion",
    purchase_order: "Orden de Compra",
    warranty: "Garantia",
    production_intake: "Ingreso produccion",
  };
  return labels[type] ?? type;
}

function documentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Borrador",
    issued: "Emitido",
    approved: "Aprobado",
    closed: "Cerrado",
    cancelled: "Anulado",
  };
  return labels[status] ?? status;
}

function formatCurrency(value?: number) {
  if (value === undefined) return "$0";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}
