import {
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
  Factory,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { OrderTable } from "@/components/order-table";
import { ProductionTimeline } from "@/components/production-timeline";
import { PrintButton } from "@/components/print-button";
import { StatCard } from "@/components/stat-card";
import { StockPanel } from "@/components/stock-panel";
import { requireSession } from "@/lib/auth";
import { getSystemSettings } from "@/lib/repositories/settings";
import { activeOrders, blockedOrders, overdueOrders, urgentOrders } from "@/lib/metrics";
import { listOrders, listStockItems } from "@/lib/repositories/production";
import { deliveryLabel, formatDate } from "@/lib/utils";

export default async function AdminPage() {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const [orders, stockItems, settings] = await Promise.all([listOrders(), listStockItems(), getSystemSettings()]);
  const canEditOrders = user.role === "admin" || (user.role === "manager" && settings.permissions.managersCanEditOrders);
  const active = activeOrders(orders);
  const urgent = urgentOrders(orders);
  const overdue = overdueOrders(orders);
  const blocked = blockedOrders(orders);
  const nextDeliveries = [...active]
    .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))
    .slice(0, 4);

  return (
    <AppShell active="admin" user={user}>
      <header className="flex flex-col gap-4 border-b border-stone-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
            Panel administrador
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
            Produccion, ventas activas y control operativo
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
            Vista ejecutiva para revisar avance diario, atrasos, responsables,
            stock critico y prioridades entre Leather House y La Reina.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintButton />
          {canEditOrders ? (
            <Link
              href="/admin/orders/new"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-medium text-white"
            >
              <Plus className="size-4" />
              Nueva nota
            </Link>
          ) : null}
        </div>
      </header>

      <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ordenes activas"
          value={String(active.length)}
          helper="Produccion abierta entre ambas tiendas."
          icon={ClipboardCheck}
          tone="blue"
        />
        <StatCard
          label="Urgentes"
          value={String(urgent.length)}
          helper="Requieren seguimiento diario."
          icon={AlertTriangle}
          tone="amber"
        />
        <StatCard
          label="Atrasadas"
          value={String(overdue.length)}
          helper="Compromisos fuera de plazo."
          icon={CalendarDays}
          tone={overdue.length ? "rose" : "emerald"}
        />
        <StatCard
          label="Bloqueadas"
          value={String(blocked.length)}
          helper="Frenadas por decision, material o revision."
          icon={Factory}
          tone={blocked.length ? "rose" : "neutral"}
        />
      </section>

      <section className="mt-5 min-w-0">
        <OrderTable orders={active} canEditOrders={canEditOrders} />
      </section>

      <section className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <ProductionTimeline orders={active} />

        <div className="grid min-w-0 gap-5 md:grid-cols-2">
          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <div>
              <h2 className="text-base font-semibold">Proximas entregas</h2>
              <p className="text-sm text-stone-500">Agenda para priorizar el taller.</p>
            </div>
            <div className="mt-4 space-y-3">
              {nextDeliveries.length ? nextDeliveries.map((order) => (
                <div
                  key={order.id}
                  className="rounded-md border border-stone-200 bg-stone-50 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-stone-500">
                        {order.code}
                      </p>
                      <p className="truncate text-sm font-semibold">{order.client}</p>
                      <p className="truncate text-xs text-stone-500">{order.product}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">{formatDate(order.deliveryDate)}</p>
                      <p className="text-xs font-semibold text-rose-600">
                        {deliveryLabel(order.deliveryDate, false)}
                      </p>
                    </div>
                  </div>
                </div>
              )) : (
                <p className="rounded-md border border-dashed border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
                  No hay entregas activas. Crea la primera nota para comenzar a operar.
                </p>
              )}
            </div>
          </section>

          <StockPanel items={stockItems} />
        </div>
      </section>
    </AppShell>
  );
}
