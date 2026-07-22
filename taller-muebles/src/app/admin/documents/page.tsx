import { ChevronDown, FileText, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { listOrders } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import type { CommercialDocumentType, Order } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type DocumentSummary = {
  key: string;
  type: CommercialDocumentType;
  code: string;
  status: Order["documentStatus"];
  client: string;
  store: Order["store"];
  entryDate: string;
  deliveryDate: string;
  total?: number;
  paidAmount?: number;
  balance?: number;
  orders: Order[];
};

const documentOrder: CommercialDocumentType[] = ["sales_note", "quote", "purchase_order", "warranty"];

export default async function DocumentsPage() {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const [orders, settings] = await Promise.all([listOrders(), getSystemSettings()]);
  const canEditOrders = user.role === "admin" || (user.role === "manager" && settings.permissions.managersCanEditOrders);
  const documents = groupDocuments(orders);

  return (
    <AppShell active="admin" user={user}>
      <header className="page-header">
        <div>
          <p className="page-kicker">Comercial</p>
          <h1 className="page-title">Documentos comerciales</h1>
          <p className="page-description">Notas de venta, cotizaciones, órdenes de compra y garantías del área comercial.</p>
        </div>
        {canEditOrders ? (
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/orders/new?type=sales_note" className="btn btn-secondary">
              <Plus className="size-4" />
              Nueva nota de venta
            </Link>
            <Link href="/admin/orders/new?type=quote" className="btn btn-primary">
              <Plus className="size-4" />
              Nueva cotización
            </Link>
          </div>
        ) : null}
      </header>

      <section className="mt-5 grid gap-4">
        {documentOrder.map((type) => {
          const rows = documents.filter((document) => document.type === type);
          const isQuote = type === "quote";
          return (
            <details key={type} open={isQuote} className="panel group/document overflow-hidden">
              <summary className="panel-header flex cursor-pointer list-none items-center justify-between gap-3 transition hover:bg-stone-50 [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-3">
                  <FileText className="size-5 text-stone-500" />
                  <div>
                    <h2 className="panel-title">{documentTypeLabel(type)}</h2>
                    <p className="panel-description">{rows.length} documentos registrados.</p>
                  </div>
                </div>
                <ChevronDown className="size-5 shrink-0 text-stone-400 transition group-open/document:rotate-180" />
              </summary>
              {type === "sales_note" ? (
                <div className="grid gap-4 p-4">
                  {rows.map((document) => {
                    const firstOrder = document.orders[0];
                    return (
                      <details key={document.key} className="group/note overflow-hidden rounded-lg border border-stone-200 bg-white">
                        <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-3 transition hover:bg-stone-50 [&::-webkit-details-marker]:hidden">
                          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-[minmax(220px,1.4fr)_110px_repeat(3,minmax(120px,0.7fr))]">
                            <SummaryField label="Nombre del cliente" value={document.client} className="col-span-2 lg:col-span-1" />
                            <SummaryField label="Código" value={document.code} mono />
                            <SummaryField label="Total de la compra" value={formatCurrency(document.total)} />
                            <SummaryField label="Abonó" value={formatCurrency(document.paidAmount)} />
                            <SummaryField label="Debe" value={formatCurrency(document.balance)} strong />
                          </div>
                          <div className="flex shrink-0 items-center gap-3 text-xs font-medium text-stone-500">
                            <span className="hidden xl:inline">
                              {firstOrder?.documentStatus === "issued" ? "Emitida" : documentStatusLabel(document.status)} · {formatDate(document.entryDate)}
                            </span>
                            <ChevronDown className="size-4 transition group-open/note:rotate-180" />
                          </div>
                        </summary>
                        <div className="border-t border-stone-200 p-4">
                          {firstOrder ? (
                            <Link href={`/admin/orders/${firstOrder.id}`} className="btn btn-primary">
                              Abrir nota de venta
                            </Link>
                          ) : null}
                        </div>
                      </details>
                    );
                  })}
                  {!rows.length ? <p className="py-4 text-center text-sm text-stone-500">No hay documentos de esta categoría.</p> : null}
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Documento</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Productos</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Entrega</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Total</th>
                      {!isQuote ? <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Abono</th> : null}
                      {!isQuote ? <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Saldo</th> : null}
                      {!isQuote ? <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Producción</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((document) => {
                      const documentHref = `/admin/documents/${encodeURIComponent(document.code)}`;
                      return (
                      <tr
                        key={document.key}
                        className="group cursor-pointer border-b border-stone-100 last:border-0 hover:bg-stone-50"
                      >
                        <ClickableCell href={documentHref}>
                          <span className="font-mono text-sm font-semibold underline-offset-4 group-hover:underline">
                            {document.code}
                          </span>
                          <span className="mt-1 block text-xs text-stone-500">{documentStatusLabel(document.status)} - {document.store}</span>
                        </ClickableCell>
                        <ClickableCell href={documentHref} className="text-sm font-medium text-stone-900">{document.client}</ClickableCell>
                        <ClickableCell href={documentHref} className="text-sm text-stone-600">{document.orders.length}</ClickableCell>
                        <ClickableCell href={documentHref} className="text-sm text-stone-600">{formatDate(document.deliveryDate)}</ClickableCell>
                        <ClickableCell href={documentHref} className="text-sm font-semibold text-stone-900">{formatCurrency(document.total)}</ClickableCell>
                        {!isQuote ? <ClickableCell href={documentHref} className="text-sm text-stone-600">{formatCurrency(document.paidAmount)}</ClickableCell> : null}
                        {!isQuote ? <ClickableCell href={documentHref} className="text-sm font-semibold text-stone-900">{formatCurrency(document.balance)}</ClickableCell> : null}
                        {!isQuote ? <ClickableCell href={documentHref} className="text-sm text-stone-600">{document.orders[0].status}</ClickableCell> : null}
                      </tr>
                      );
                    })}
                    {!rows.length ? (
                      <tr>
                        <td colSpan={isQuote ? 5 : 8} className="px-4 py-8 text-center text-sm text-stone-500">
                          No hay documentos de esta categoria.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              )}
            </details>
          );
        })}
      </section>
    </AppShell>
  );
}

function ClickableCell({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <td className="p-0 align-middle">
      <a href={href} className={`block px-4 py-3 ${className ?? ""}`}>
        {children}
      </a>
    </td>
  );
}

function SummaryField({
  label,
  value,
  className = "",
  mono = false,
  strong = false,
}: {
  label: string;
  value: string;
  className?: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-400">{label}</span>
      <span className={`mt-0.5 block truncate text-sm text-stone-900 ${mono ? "font-mono font-bold" : strong ? "font-bold" : "font-medium"}`}>
        {value}
      </span>
    </div>
  );
}

function groupDocuments(orders: Order[]): DocumentSummary[] {
  const map = new Map<string, Order[]>();
  for (const order of orders) {
    if (order.documentType === "production_intake") continue;
    const key = `${order.store}:${order.groupCode || order.code}`;
    map.set(key, [...(map.get(key) ?? []), order]);
  }

  return Array.from(map.entries()).map(([key, group]) => {
    const first = group[0];
    const total = first.total ?? 0;
    const paidAmount = first.payments?.length
      ? first.payments.reduce((sum, payment) => sum + payment.amount, 0)
      : (first.paidAmount ?? 0);
    return {
      key,
      type: first.documentType,
      code: first.groupCode || first.code,
      status: first.documentStatus,
      client: first.client,
      store: first.store,
      entryDate: first.entryDate,
      deliveryDate: first.deliveryDate,
      total,
      paidAmount,
      balance: Math.max(total - paidAmount, 0),
      orders: group.sort((a, b) => a.product.localeCompare(b.product)),
    };
  }).sort((a, b) => {
    const entryDiff = dateTime(b.entryDate) - dateTime(a.entryDate);
    return entryDiff || b.code.localeCompare(a.code);
  });
}

function dateTime(value?: string) {
  if (!value) return 0;
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function documentTypeLabel(type: string) {
  const labels: Record<string, string> = {
    sales_note: "Notas de Venta",
    quote: "Cotizaciones",
    purchase_order: "Órdenes de Compra",
    warranty: "Garantías",
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
  if (typeof value !== "number" || !Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}
