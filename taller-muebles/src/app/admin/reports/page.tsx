import { BarChart3, Clock, Factory, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { requireSession } from "@/lib/auth";
import { activeOrders, areaLoad, blockedOrders, completionPercent, overdueOrders, urgentOrders } from "@/lib/metrics";
import { listOrders } from "@/lib/repositories/production";
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
      <header className="border-b border-stone-200 pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
          Reportes
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Indicadores del taller</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          Reportes iniciales para operar. La IA se conectara sobre esta base para explicar atrasos y sugerir prioridades.
        </p>
      </header>

      <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Activas" value={String(active.length)} helper="Ordenes en flujo." icon={Factory} tone="blue" />
        <StatCard label="Urgentes" value={String(urgent.length)} helper="Seguimiento diario." icon={TriangleAlert} tone="amber" />
        <StatCard label="Atrasadas" value={String(overdue.length)} helper="Fuera de plazo." icon={Clock} tone={overdue.length ? "rose" : "emerald"} />
        <StatCard label="Bloqueadas" value={String(blocked.length)} helper="Requieren decision." icon={BarChart3} tone={blocked.length ? "rose" : "neutral"} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-200 p-4">
            <h2 className="text-base font-semibold">Carga por área</h2>
            <p className="text-sm text-stone-500">Etapas activas y bloqueadas.</p>
          </div>
          <div className="divide-y divide-stone-100">
            {load.map((area) => (
              <div key={area.label} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{area.label}</p>
                  <p className="text-xs font-medium text-stone-500">{area.active + area.blocked} pendientes</p>
                </div>
                <div className="mt-3 flex gap-1">
                  <span className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.max(area.active * 18, 8)}px` }} />
                  {area.blocked ? <span className="h-2 rounded-full bg-rose-500" style={{ width: `${Math.max(area.blocked * 18, 8)}px` }} /> : null}
                </div>
                <p className="mt-2 text-xs text-stone-500">{area.active} activas · {area.blocked} bloqueadas · {area.done} terminadas</p>
              </div>
            ))}
            {!load.length ? <p className="p-5 text-sm text-stone-500">No hay carga productiva activa.</p> : null}
          </div>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-200 p-4">
            <h2 className="text-base font-semibold">Órdenes en riesgo</h2>
            <p className="text-sm text-stone-500">Entregas cercanas, bloqueadas o con avance insuficiente.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                <tr><th className="px-4 py-3">Orden</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Entrega</th><th className="px-4 py-3">Avance</th></tr>
              </thead>
              <tbody>
                {riskOrders.map((order) => (
                  <tr key={order.id} className="border-t border-stone-100">
                    <td className="px-4 py-3"><Link href={`/admin/orders/${order.id}`} className="font-mono text-sm font-semibold hover:underline">{order.code}</Link></td>
                    <td className="px-4 py-3 text-sm">{order.client}</td>
                    <td className="px-4 py-3"><p className="text-sm font-medium">{formatDate(order.deliveryDate)}</p><p className="text-xs font-semibold text-rose-600">{deliveryLabel(order.deliveryDate, false)}</p></td>
                    <td className="px-4 py-3 text-sm font-semibold">{completionPercent(order)}%</td>
                  </tr>
                ))}
                {!riskOrders.length ? <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-stone-500">No hay órdenes en riesgo.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
