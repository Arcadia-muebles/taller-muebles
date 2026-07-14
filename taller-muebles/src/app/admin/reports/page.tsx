import { CheckCircle2, CircleAlert, Clock3, ListChecks } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { requireSession } from "@/lib/auth";
import { productivityByArea } from "@/lib/metrics";
import { isProductionOrder } from "@/lib/orders";
import { listOrders, listUsers } from "@/lib/repositories/production";
import { workshopHoursBetween } from "@/lib/utils";

export default async function ReportsPage() {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const [orders, users] = await Promise.all([listOrders(), listUsers()]);
  const productionOrders = orders.filter(isProductionOrder);
  const areas = productivityByArea(productionOrders, users);
  const totals = areas.reduce(
    (summary, area) => ({
      assigned: summary.assigned + area.assigned,
      completed: summary.completed + area.completed,
      active: summary.active + area.active,
      pending: summary.pending + area.pending,
      blocked: summary.blocked + area.blocked,
    }),
    { assigned: 0, completed: 0, active: 0, pending: 0, blocked: 0 },
  );
  const cycleHours = productionOrders.flatMap((order) => order.steps.flatMap((step) => {
    if (!step.startedAt || !step.completedAt) return [];
    const hours = workshopHoursBetween(step.startedAt, step.completedAt);
    return Number.isFinite(hours) ? [hours] : [];
  }));
  const averageCycleHours = cycleHours.length
    ? cycleHours.reduce((total, hours) => total + hours, 0) / cycleHours.length
    : undefined;
  const workers = areas.flatMap((area) => area.members.map((member) => ({ ...member, area: area.label })));
  const attentionAreas = areas
    .filter((area) => area.blocked || area.active + area.pending)
    .sort((a, b) => b.blocked - a.blocked || (b.active + b.pending) - (a.active + a.pending))
    .slice(0, 4);

  return (
    <AppShell active="admin" user={user}>
      <header className="page-header">
        <div>
          <p className="page-kicker">Reportes</p>
          <h1 className="page-title">Producción, en simple</h1>
          <p className="page-description max-w-2xl">Revisa qué se terminó, quién tiene carga y dónde se está acumulando el trabajo.</p>
        </div>
      </header>

      <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Etapas terminadas" value={`${totals.completed}`} helper={`De ${totals.assigned} asignadas.`} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Trabajo en curso" value={`${totals.active + totals.pending}`} helper={`${totals.active} activas ahora.`} icon={ListChecks} tone="blue" />
        <StatCard label="Bloqueos" value={`${totals.blocked}`} helper={totals.blocked ? "Requieren revisión." : "Sin bloqueos actuales."} icon={CircleAlert} tone={totals.blocked ? "rose" : "neutral"} />
        <StatCard label="Duración promedio" value={formatDuration(averageCycleHours, true)} helper="Etapas con inicio y término." icon={Clock3} tone="amber" />
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.8fr)]">
        <div className="panel overflow-hidden">
          <div className="panel-header">
            <h2 className="panel-title">Rendimiento de trabajadores</h2>
            <p className="panel-description">Cada fila representa el trabajo de una persona dentro de su área.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed">
              <thead className="table-head">
                <tr>
                  <th className="w-[24%] px-4 py-3 text-left">Trabajador</th>
                  <th className="w-[17%] px-3 py-3 text-left">Área</th>
                  <th className="w-[15%] px-3 py-3 text-center">Terminadas</th>
                  <th className="w-[14%] px-3 py-3 text-center">Product.</th>
                  <th className="w-[12%] px-3 py-3 text-center">En curso</th>
                  <th className="w-[9%] px-3 py-3 text-center">Bloq.</th>
                  <th className="w-[9%] px-3 py-3 text-center">Duración</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((worker) => (
                  <tr key={`${worker.area}-${worker.name}`} className="border-t border-stone-100">
                    <td className="px-4 py-3 text-sm font-semibold text-stone-950"><span className="block truncate">{worker.name}</span></td>
                    <td className="px-3 py-3 text-sm text-stone-600"><span className="block truncate">{worker.area}</span></td>
                    <td className="px-3 py-3 text-center text-sm"><span className="font-semibold text-stone-950">{worker.completed}</span><span className="text-stone-400"> / {worker.assigned}</span></td>
                    <td className="px-3 py-3 text-center text-sm font-semibold text-emerald-700">{worker.completionRate}%</td>
                    <td className="px-3 py-3 text-center text-sm font-medium text-sky-700">{worker.active + worker.pending || "—"}</td>
                    <td className="px-3 py-3 text-center text-sm font-semibold text-rose-700">{worker.blocked || "—"}</td>
                    <td className="px-3 py-3 text-center text-xs text-stone-600">{formatDuration(worker.averageCycleHours)}</td>
                  </tr>
                ))}
                {!workers.length ? <EmptyRow colSpan={7} message="Aún no hay trabajo asignado a personas." /> : null}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Para revisar hoy</h2>
            <p className="panel-description">Áreas con bloqueos o mayor carga pendiente.</p>
          </div>
          <div className="divide-y divide-stone-100">
            {attentionAreas.map((area) => (
              <div key={area.key} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-stone-950">{area.label}</p>
                  {area.blocked ? <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">{area.blocked} bloqueada{area.blocked === 1 ? "" : "s"}</span> : null}
                </div>
                <p className="mt-1 text-sm text-stone-600">{area.active + area.pending} etapas por terminar · {area.members.length} persona{area.members.length === 1 ? "" : "s"}</p>
              </div>
            ))}
            {!attentionAreas.length ? <p className="p-5 text-sm text-stone-500">No hay trabajo pendiente ni bloqueos.</p> : null}
          </div>
        </aside>
      </section>

      <section className="mt-5 panel overflow-hidden">
        <div className="panel-header">
          <h2 className="panel-title">Estado por etapa</h2>
            <p className="panel-description">Duración mide el trabajo activo. Sin trabajo mide el tiempo entre un término y el siguiente inicio de esa etapa.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] table-fixed">
            <thead className="table-head">
              <tr>
                <th className="w-[22%] px-4 py-3 text-left">Etapa</th>
                <th className="w-[14%] px-3 py-3 text-center">Terminadas</th>
                <th className="w-[14%] px-3 py-3 text-center">En curso</th>
                <th className="w-[12%] px-3 py-3 text-center">Bloqueadas</th>
                <th className="w-[14%] px-3 py-3 text-center">Duración media</th>
                <th className="w-[14%] px-3 py-3 text-center">Sin trabajo</th>
                <th className="w-[10%] px-3 py-3 text-center">Personas</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((area) => (
                <tr key={area.key} className="border-t border-stone-100">
                  <td className="px-4 py-3 text-sm font-semibold text-stone-950">{area.label}</td>
                  <td className="px-3 py-3 text-center text-sm"><span className="font-semibold">{area.completed}</span><span className="text-stone-400"> / {area.assigned}</span></td>
                  <td className="px-3 py-3 text-center text-sm font-medium text-sky-700">{area.active + area.pending || "—"}</td>
                  <td className="px-3 py-3 text-center text-sm font-semibold text-rose-700">{area.blocked || "—"}</td>
                  <td className="px-3 py-3 text-center text-sm text-stone-600">{formatDuration(area.averageCycleHours)}</td>
                  <td className="px-3 py-3 text-center text-sm text-stone-600">{formatDuration(area.averageIdleHours)}</td>
                  <td className="px-3 py-3 text-center text-sm text-stone-600">{area.members.length}</td>
                </tr>
              ))}
              {!areas.length ? <EmptyRow colSpan={7} message="Aún no hay etapas de producción registradas." /> : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return <tr><td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-stone-500">{message}</td></tr>;
}

function formatDuration(hours?: number, prominent = false) {
  if (hours === undefined) return prominent ? "—" : "Sin datos";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours >= 24) return `${(hours / 24).toFixed(1)} días`;
  return `${hours.toFixed(1)} h`;
}
