import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
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
          <p className="page-description">
            Notas de venta, cotizaciones, ordenes de compra y garantias vinculadas a producción.
          </p>
        </div>
        {canEditOrders ? (
          <Link href="/admin/orders/new" className="btn btn-primary">
            <Plus className="size-4" />
            Nuevo registro
          </Link>
        ) : null}
      </header>

      <section className="mt-5 grid gap-4">
        {documentOrder.map((type) => {
          const rows = documents.filter((document) => document.type === type);
          return (
            <section key={type} className="panel">
              <div className="panel-header flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <FileText className="size-5 text-stone-500" />
                  <div>
                    <h2 className="panel-title">{documentTypeLabel(type)}</h2>
                    <p className="panel-description">{rows.length} documentos registrados.</p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Documento</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Productos</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Entrega</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Abono</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Saldo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Producción</th>
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
                        <ClickableCell href={documentHref} className="text-sm text-stone-600">{formatCurrency(document.paidAmount)}</ClickableCell>
                        <ClickableCell href={documentHref} className="text-sm font-semibold text-stone-900">{formatCurrency(document.balance)}</ClickableCell>
                        <td className="px-4 py-3 align-middle">
                          <a href={documentHref} className="inline-block">
                            <StatusBadge type="order" value={document.orders[0].status} />
                          </a>
                        </td>
                      </tr>
                      );
                    })}
                    {!rows.length ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-sm text-stone-500">
                          No hay documentos de esta categoria.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
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

function groupDocuments(orders: Order[]): DocumentSummary[] {
  const map = new Map<string, Order[]>();
  for (const order of orders) {
    if (order.documentType === "production_intake") continue;
    const key = `${order.store}:${order.groupCode || order.code}`;
    map.set(key, [...(map.get(key) ?? []), order]);
  }

  return Array.from(map.entries()).map(([key, group]) => {
    const first = group[0];
    return {
      key,
      type: first.documentType,
      code: first.groupCode || first.code,
      status: first.documentStatus,
      client: first.client,
      store: first.store,
      entryDate: first.entryDate,
      deliveryDate: first.deliveryDate,
      total: first.total,
      paidAmount: first.paidAmount,
      balance: first.balance,
      orders: group.sort((a, b) => a.product.localeCompare(b.product)),
    };
  }).sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
}

function documentTypeLabel(type: string) {
  const labels: Record<string, string> = {
    sales_note: "Notas de Venta",
    quote: "Cotizaciones",
    purchase_order: "Ordenes de Compra",
    warranty: "Garantias",
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
