import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, FileText, Pencil, Wrench } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth";
import { listOrders } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import type { Order } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type DocumentDetailPageProps = {
  params: Promise<{ code: string }>;
};

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const [{ code }, orders, settings] = await Promise.all([params, listOrders(), getSystemSettings()]);
  const documentCode = decodeURIComponent(code);
  const documentOrders = orders
    .filter((order) => order.documentType !== "production_intake")
    .filter((order) => (order.groupCode || order.code) === documentCode)
    .sort((a, b) => a.product.localeCompare(b.product));

  if (!documentOrders.length) notFound();

  const document = documentOrders[0];
  const financials = documentFinancials(document, documentOrders);
  const canEditOrders = user.role === "admin" || (user.role === "manager" && settings.permissions.managersCanEditOrders);

  return (
    <AppShell active="admin" user={user}>
      <header className="page-header">
        <div>
          <Link href="/admin/documents" className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-stone-950">
            <ArrowLeft className="size-4" />
            Volver a comercial
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="page-title mt-0">{documentCode}</h1>
            <span className="inline-flex h-7 items-center rounded-full border border-stone-200 bg-white px-2.5 text-xs font-medium text-stone-700">
              {documentTypeLabel(document.documentType)}
            </span>
            <span className="inline-flex h-7 items-center rounded-full border border-stone-200 bg-white px-2.5 text-xs font-medium text-stone-700">
              {documentStatusLabel(document.documentStatus)}
            </span>
          </div>
          <p className="page-description">
            Vista completa del registro comercial y de los productos que alimentan producción.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/orders/${document.id}`} className="btn btn-secondary">
            <Wrench className="size-4" />
            Ver producción
          </Link>
          {canEditOrders ? (
            <Link href={`/admin/orders/${document.id}/edit`} className="btn btn-primary">
              <Pencil className="size-4" />
              Editar documento
            </Link>
          ) : null}
        </div>
      </header>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="panel">
            <div className="panel-header flex items-center gap-3">
              <FileText className="size-5 text-stone-500" />
              <div>
                <h2 className="panel-title">Datos del cliente</h2>
                <p className="panel-description">Informacion comercial registrada en el documento.</p>
              </div>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <Info label="Cliente" value={document.client} />
              <Info label="Tienda" value={document.store} />
              <Info label="RUT" value={document.customerRut} />
              <Info label="Teléfono" value={document.customerPhone} />
              <Info label="Correo" value={document.customerEmail} />
              <Info label="Dirección" value={document.customerAddress} />
              <Info label="Comuna" value={document.customerCommune} />
              <Info label="Contacto general" value={document.customerContact} />
              <Info label="Vendedor" value={document.sellerName} />
            </div>
          </section>

          <section className="panel">
            <div className="panel-header flex items-center gap-3">
              <Wrench className="size-5 text-stone-500" />
              <div>
                <h2 className="panel-title">Productos</h2>
                <p className="panel-description">Cada fila mantiene su propia orden productiva.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Producto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Material</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Color</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Cant.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Precio</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Subtotal</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Producción</th>
                  </tr>
                </thead>
                <tbody>
                  {documentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                      <td className="px-4 py-3 align-middle">
                        <Link href={`/admin/orders/${order.id}`} className="text-sm font-semibold text-stone-950 underline-offset-4 hover:underline">
                          {order.product}
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-middle text-sm text-stone-600">{order.material}</td>
                      <td className="px-4 py-3 align-middle text-sm text-stone-600">{order.color}</td>
                      <td className="px-4 py-3 align-middle text-sm text-stone-600">{formatQuantity(order.quantity)}</td>
                      <td className="px-4 py-3 align-middle text-sm text-stone-600">{formatCurrency(order.unitPrice)}</td>
                      <td className="px-4 py-3 align-middle text-sm font-semibold text-stone-900">{formatCurrency(lineTotal(order))}</td>
                      <td className="px-4 py-3 align-middle">
                        <StatusBadge type="order" value={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Observaciones</h2>
              <p className="panel-description">Notas comerciales u operativas asociadas al documento.</p>
            </div>
            <div className="grid gap-3 p-4">
              {documentOrders.map((order) => (
                <div key={order.id} className="rounded-md border border-stone-200 bg-stone-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{order.product}</p>
                  <p className="mt-1 text-sm leading-6 text-stone-700">{order.observations || "Sin observaciones."}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="panel p-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="size-5 text-stone-500" />
              <div>
                <h2 className="panel-title">Fechas</h2>
                <p className="panel-description">Ingreso y compromiso de entrega.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <Info label="Fecha ingreso" value={formatDate(document.entryDate)} />
              <Info label="Fecha entrega" value={formatDate(document.deliveryDate)} />
            </div>
          </section>

          <section className="panel p-4">
            <h2 className="panel-title">Valores</h2>
            <p className="panel-description">Resumen de abono y saldo pendiente.</p>
            <div className="mt-4 grid gap-3">
              <Info label="Subtotal" value={formatCurrency(financials.subtotal)} />
              <Info label="Descuento" value={formatCurrency(financials.discount)} />
              <Info label="Total" value={formatCurrency(financials.total)} strong />
              <Info label="Abono" value={formatCurrency(financials.paidAmount)} />
              <Info label="Saldo" value={formatCurrency(financials.balance)} strong />
              <Info label="Medio de pago" value={document.paymentMethod} />
            </div>
          </section>

          <section className="panel p-4">
            <h2 className="panel-title">Condiciones de entrega</h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">
              {document.deliveryTerms?.trim() || "Sin registrar"}
            </p>
          </section>
        </aside>
      </section>
    </AppShell>
  );
}

function Info({ label, value, strong }: { label: string; value?: string; strong?: boolean }) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">{label}</p>
      <p className={`mt-1 text-sm ${strong ? "font-semibold text-rose-700" : "font-medium text-stone-900"}`}>
        {value?.trim() || "Sin registrar"}
      </p>
    </div>
  );
}

function documentFinancials(document: Order, orders: Order[]) {
  const subtotal = numberOrUndefined(document.subtotal) ?? orders.reduce((sum, order) => sum + lineTotal(order), 0);
  const discount = numberOrUndefined(document.discount) ?? 0;
  const total = numberOrUndefined(document.total) ?? Math.max(subtotal - discount, 0);
  const paidAmount = numberOrUndefined(document.paidAmount) ?? 0;
  const balance = numberOrUndefined(document.balance) ?? Math.max(total - paidAmount, 0);

  return { subtotal, discount, total, paidAmount, balance };
}

function lineTotal(order: Order) {
  return (numberOrUndefined(order.quantity) ?? 1) * (numberOrUndefined(order.unitPrice) ?? 0);
}

function numberOrUndefined(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formatQuantity(value?: number) {
  const quantity = numberOrUndefined(value) ?? 1;
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(quantity);
}

function formatCurrency(value?: number) {
  const amount = numberOrUndefined(value) ?? 0;
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function documentTypeLabel(type: string) {
  const labels: Record<string, string> = {
    sales_note: "Nota de Venta",
    quote: "Cotización",
    purchase_order: "Orden de Compra",
    warranty: "Garantía",
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
