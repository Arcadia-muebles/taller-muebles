import { BarChart3, Clock, Factory, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { activeOrders, blockedOrders, overdueOrders, urgentOrders } from "@/lib/metrics";
import { listOrders } from "@/lib/repositories/production";

export default async function ReportsPage() {
  const orders = await listOrders();
  const active = activeOrders(orders);
  const urgent = urgentOrders(orders);
  const overdue = overdueOrders(orders);
  const blocked = blockedOrders(orders);

  return (
    <AppShell active="admin" user={{ name: "Rodrigo", role: "Administrador" }}>
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

      <section className="mt-5 rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="text-base font-semibold">Reporte semanal propuesto</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            ["Cuellos de botella", "Procesos con mas etapas activas o bloqueadas."],
            ["Riesgo de atraso", "Ordenes con entrega cercana y bajo avance."],
            ["Consumo de materiales", "Materiales que deben comprarse antes de frenar produccion."],
          ].map(([title, copy]) => (
            <div key={title} className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">{copy}</p>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
