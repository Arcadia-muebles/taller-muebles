import { BarChart3, Clock, Factory, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { requireSession } from "@/lib/auth";
import { activeOrders, areaLoad, blockedOrders, completionPercent, overdueOrders, urgentOrders } from "@/lib/metrics";
import { listOrders } from "@/lib/repositories/production";
import type { Order } from "@/lib/types";
import { deliveryLabel, formatDate } from "@/lib/utils";

export default async function ReportsPage() {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const orders = await listOrders();
  const active = activeOrders(orders);
  const urgent = urgentOrders(orders);
  const overdue = overdueOrders(orders);
  const blocked = blockedOrders(orders);
  const load = areaLoad(active);
  const riskOrders = [...active]
    .filter((order) => completionPercent(order) < 80 || blocked.includes(order) || overdue.includes(order))
    .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))
    .slice(0, 10);

  return (
    <AppShell active="admin" user={user}>
      <header className="page-header">
        <div>
          <p className="page-kicker">Reportes</p>
          <h1 className="page-title">Indicadores del taller</h1>
          <p className="page-description max-w-2xl">
          Reportes iniciales para operar. La IA se conectará sobre esta base para explicar atrasos y sugerir prioridades.
          </p>
        </div>
      </header>

      <section className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Activas" value={String(active.length)} helper="Órdenes en flujo." icon={Factory} tone="blue" />
        <StatCard label="Urgentes" value={String(urgent.length)} helper="Seguimiento diario." icon={TriangleAlert} tone="amber" />
        <StatCard label="Atrasadas" value={String(overdue.length)} helper="Fuera de plazo." icon={Clock} tone={overdue.length ? "rose" : "emerald"} />
        <StatCard label="Bloqueadas" value={String(blocked.length)} helper="Requieren decision." icon={BarChart3} tone={blocked.length ? "rose" : "neutral"} />
      </section>

      <section className="mt-5 grid min-w-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Carga por área</h2>
            <p className="panel-description">Etapas activas y bloqueadas.</p>
          </div>
          <div className="divide-y divide-stone-100">
            {load.map((area) => (
              <div key={area.label} className="p-4">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold">{area.label}</p>
                  <p className="shrink-0 text-xs font-medium text-stone-500">{area.active + area.blocked} pendientes</p>
                </div>
                <div className="mt-3 flex min-w-0 gap-1">
                  <span className="h-2 max-w-full rounded-full bg-blue-500" style={{ width: `${Math.min(Math.max(area.active * 18, 8), 220)}px` }} />
                  {area.blocked ? <span className="h-2 max-w-full rounded-full bg-rose-500" style={{ width: `${Math.min(Math.max(area.blocked * 18, 8), 140)}px` }} /> : null}
                </div>
                <p className="mt-2 text-xs text-stone-500">{area.active} activas · {area.blocked} bloqueadas · {area.done} terminadas</p>
              </div>
            ))}
            {!load.length ? <p className="p-5 text-sm text-stone-500">No hay carga productiva activa.</p> : null}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Órdenes en riesgo</h2>
            <p className="panel-description">Entregas cercanas, bloqueadas o con avance insuficiente.</p>
          </div>

          <div className="grid gap-3 p-3 lg:hidden">
            {riskOrders.map((order) => <RiskCard key={order.id} order={order} />)}
            {!riskOrders.length ? <EmptyState /> : null}
          </div>

          <div className="hidden lg:block">
            <table className="w-full table-fixed">
              <thead className="table-head">
                <tr>
                  <th className="px-3 py-3">Orden</th>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3">Entrega</th>
                  <th className="px-3 py-3">Avance</th>
                </tr>
              </thead>
              <tbody>
                {riskOrders.map((order) => (
                  <tr key={order.id} className="border-t border-stone-100">
                    <td className="px-3 py-3">
                      <Link href={`/admin/orders/${order.id}`} className="block truncate font-mono text-sm font-semibold hover:underline">{order.code}</Link>
                    </td>
                    <td className="px-3 py-3 text-sm"><span className="block truncate">{order.client}</span></td>
                    <td className="px-3 py-3">
                      <p className="truncate text-sm font-medium">{formatDate(order.deliveryDate)}</p>
                      <p className="truncate text-xs font-semibold text-rose-600">{deliveryLabel(order.deliveryDate, false)}</p>
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold">{completionPercent(order)}%</td>
                  </tr>
                ))}
                {!riskOrders.length ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-stone-500">No hay órdenes en riesgo.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function RiskCard({ order }: { order: Order }) {
  return (
    <article className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/admin/orders/${order.id}`} className="truncate font-mono text-sm font-semibold hover:underline">{order.code}</Link>
          <p className="mt-2 truncate text-sm font-semibold text-stone-950">{order.client}</p>
        </div>
        <p className="shrink-0 text-sm font-semibold">{completionPercent(order)}%</p>
      </div>
      <p className="mt-2 text-sm font-medium">{formatDate(order.deliveryDate)}</p>
      <p className="text-xs font-semibold text-rose-600">{deliveryLabel(order.deliveryDate, false)}</p>
    </article>
  );
}

function EmptyState() {
  return <div className="empty-state">No hay órdenes en riesgo.</div>;
}
