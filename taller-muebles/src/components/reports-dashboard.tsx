"use client";

import {
  Armchair,
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  Construction,
  Download,
  PackageCheck,
  Scissors,
  Shirt,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ReportOrder, ReportUser } from "@/lib/types";
import { cn, workshopHoursBetween } from "@/lib/utils";

type Period = "today" | "week" | "month" | "custom";
type CompletedWork = {
  id: string;
  orderCode: string;
  client: string;
  product: string;
  areaKey: string;
  areaLabel: string;
  owner: string;
  startedAt: string;
  completedAt: string;
  hours: number;
};

type AreaSummary = {
  key: string;
  label: string;
  workers: WorkerSummary[];
  jobs: number;
  hours: number;
  averageHours?: number;
  active: number;
  blocked: number;
};

type WorkerSummary = {
  name: string;
  jobs: number;
  hours: number;
  share: number;
};

const unassigned = "Sin responsable";
const reportAreaOrder = [
  ["structure", "estructura"],
  ["cutting", "corte"],
  ["sewing", "costura"],
  ["upholstery", "tapiceria"],
];
const areaAccents = [
  { icon: Construction, color: "text-sky-700", soft: "bg-sky-50", bar: "bg-sky-600" },
  { icon: Scissors, color: "text-emerald-700", soft: "bg-emerald-50", bar: "bg-emerald-600" },
  { icon: Shirt, color: "text-violet-700", soft: "bg-violet-50", bar: "bg-violet-600" },
  { icon: Armchair, color: "text-amber-700", soft: "bg-amber-50", bar: "bg-amber-600" },
  { icon: BadgeCheck, color: "text-rose-700", soft: "bg-rose-50", bar: "bg-rose-600" },
  { icon: PackageCheck, color: "text-cyan-700", soft: "bg-cyan-50", bar: "bg-cyan-600" },
];

export function ReportsDashboard({ orders, users, today }: { orders: ReportOrder[]; users: ReportUser[]; today: string }) {
  const [period, setPeriod] = useState<Period>("week");
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [selectedArea, setSelectedArea] = useState<string>();
  const [selectedWorker, setSelectedWorker] = useState<string>();

  const range = useMemo(() => dateRange(period, today, customFrom, customTo), [period, today, customFrom, customTo]);
  const work = useMemo(() => completedWork(orders, range.from, range.to), [orders, range]);
  const areas = useMemo(() => summarizeAreas(orders, users, work), [orders, users, work]);
  const activeArea = areas.find((area) => area.key === selectedArea) ?? areas[0];
  const activeWorker = activeArea?.workers.some((worker) => worker.name === selectedWorker) ? selectedWorker : undefined;
  const detail = work.filter((item) => item.areaKey === activeArea?.key && (!activeWorker || item.owner === activeWorker));
  const detailHours = sum(detail.map((item) => item.hours));
  const chart = dailySeries(detail, range.from, range.to);
  const maxChartHours = Math.max(...chart.map((day) => day.hours), 1);

  function chooseArea(key: string) {
    setSelectedArea(key);
    setSelectedWorker(undefined);
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="page-kicker">Reportes</p>
          <h1 className="page-title">Rendimiento del taller</h1>
          <p className="page-description">Resumen por área y operario, calculado con los inicios y términos registrados en producción.</p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2" aria-label="Período del reporte">
            {(["today", "week", "month"] as Period[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPeriod(option)}
                className={cn("btn h-9 px-3", period === option ? "btn-primary" : "btn-secondary")}
              >
                {option === "today" ? "Hoy" : option === "week" ? "Esta semana" : "Este mes"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
            <CalendarDays className="size-4" />
            <label className="sr-only" htmlFor="report-from">Desde</label>
            <input id="report-from" type="date" value={range.inputFrom} onChange={(event) => { setCustomFrom(event.target.value); setPeriod("custom"); }} className="input h-9 w-[145px]" />
            <span>—</span>
            <label className="sr-only" htmlFor="report-to">Hasta</label>
            <input id="report-to" type="date" value={range.inputTo} onChange={(event) => { setCustomTo(event.target.value); setPeriod("custom"); }} className="input h-9 w-[145px]" />
          </div>
        </div>
      </header>

      <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Resumen por área">
        {areas.map((area, index) => {
          const accent = areaAccents[index % areaAccents.length];
          return <AreaCard key={area.key} area={area} accent={accent} selected={area.key === activeArea?.key} onSelect={() => chooseArea(area.key)} />;
        })}
        {!areas.length ? <EmptyPanel message="Todavía no hay áreas productivas registradas." /> : null}
      </section>

      {areas.length ? (
        <section className="panel mt-5 overflow-hidden">
          <div className="panel-header flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="panel-title">Operarios por área</h2>
              <p className="panel-description">Selecciona una persona para revisar sus trabajos del período.</p>
            </div>
            <p className="text-xs font-medium text-stone-500">{formatRangeLabel(range.from, range.to)}</p>
          </div>
          <div className="grid gap-px bg-stone-200 md:grid-cols-2 xl:grid-cols-4">
            {areas.map((area, index) => (
              <WorkerArea
                key={area.key}
                area={area}
                accent={areaAccents[index % areaAccents.length]}
                selectedArea={activeArea?.key}
                selectedWorker={activeWorker}
                onArea={() => chooseArea(area.key)}
                onWorker={(worker) => { setSelectedArea(area.key); setSelectedWorker(worker); }}
              />
            ))}
          </div>
        </section>
      ) : null}

      {activeArea ? (
        <section className="panel mt-5 overflow-hidden">
          <div className="grid border-b border-stone-200 md:grid-cols-4 lg:grid-cols-[minmax(260px,0.8fr)_repeat(3,minmax(130px,0.55fr))_auto]">
            <div className="flex items-center gap-3 p-4 md:col-span-2 lg:col-span-1">
              <div className={cn("grid size-10 shrink-0 place-items-center rounded-full font-semibold", areaAccents[areas.indexOf(activeArea) % areaAccents.length].soft, areaAccents[areas.indexOf(activeArea) % areaAccents.length].color)}>
                {initials(activeWorker ?? activeArea.label)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">{activeArea.label}</p>
                {activeArea.workers.length > 1 ? (
                  <select
                    aria-label={`Operario de ${activeArea.label}`}
                    value={activeWorker ?? ""}
                    onChange={(event) => setSelectedWorker(event.target.value || undefined)}
                    className="mt-1 h-8 max-w-full rounded-md border border-stone-200 bg-white px-2 text-sm font-semibold text-stone-950 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
                  >
                    <option value="">Toda el área</option>
                    {activeArea.workers.map((worker) => <option key={worker.name} value={worker.name}>{worker.name}</option>)}
                  </select>
                ) : (
                  <p className="truncate font-semibold text-stone-950">{activeWorker ?? "Toda el área"}</p>
                )}
              </div>
            </div>
            <Metric label="Trabajos realizados" value={`${detail.length}`} className="md:border-l md:border-t-0" />
            <Metric label="Tiempo productivo" value={formatDuration(detailHours)} className="md:border-l md:border-t-0" />
            <Metric label="Promedio por trabajo" value={detail.length ? formatDuration(detailHours / detail.length) : "Sin datos"} />
            <div className="flex items-center border-t border-stone-200 p-4 md:col-span-3 md:justify-end lg:col-span-1 lg:border-t-0">
              <button type="button" onClick={() => exportCsv(detail, activeArea.label, activeWorker, range)} disabled={!detail.length} className="btn btn-secondary h-9 disabled:cursor-not-allowed disabled:opacity-50">
                <Download className="size-4" /> Exportar CSV
              </button>
            </div>
          </div>

          <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 border-b border-stone-200 xl:border-b-0 xl:border-r">
              <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-sm font-semibold text-stone-950">Detalle de trabajos</p>
                <p className="text-xs text-stone-500">{detail.length} registro{detail.length === 1 ? "" : "s"}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] table-fixed">
                  <thead className="table-head">
                    <tr>
                      <th className="w-[9%] px-4 py-3">Código</th>
                      <th className="w-[16%] px-3 py-3">Cliente</th>
                      <th className="w-[24%] px-3 py-3">Trabajo realizado</th>
                      <th className="w-[13%] px-3 py-3">Inicio</th>
                      <th className="w-[13%] px-3 py-3">Término</th>
                      <th className="w-[11%] px-3 py-3 text-right">Tiempo activo</th>
                      <th className="w-[14%] px-2 py-3 text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.map((item) => (
                      <tr key={item.id} className="border-t border-stone-100 text-sm">
                        <td className="px-4 py-3 font-semibold text-stone-950">{item.orderCode}</td>
                        <td className="px-3 py-3 text-stone-700">{item.client}</td>
                        <td className="max-w-[260px] px-3 py-3"><span className="block truncate font-medium text-stone-900">{item.areaLabel}: {item.product}</span></td>
                        <td className="px-3 py-3 text-stone-600">{formatDateTime(item.startedAt)}</td>
                        <td className="px-3 py-3 text-stone-600">{formatDateTime(item.completedAt)}</td>
                        <td className="px-3 py-3 text-right font-medium text-stone-900">{formatDuration(item.hours)}</td>
                        <td className="px-2 py-3 text-right"><span className="whitespace-nowrap rounded-full bg-emerald-50 px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Terminado</span></td>
                      </tr>
                    ))}
                    {!detail.length ? <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-stone-500">No hay trabajos terminados para esta selección.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="min-w-0 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-stone-950">Tiempo productivo por día</h3>
                  <p className="mt-1 text-xs text-stone-500">Sólo etapas terminadas en el período.</p>
                </div>
                <Timer className="size-5 text-stone-400" />
              </div>
              <div className="mt-5 overflow-x-auto pb-1">
                <div className="flex h-52 items-end gap-2 border-b border-stone-200 px-1" style={{ minWidth: `${Math.max(280, chart.length * 38)}px` }}>
                  {chart.map((day) => (
                    <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                      <span className="text-[10px] font-medium text-stone-600">{day.hours ? formatDuration(day.hours, true) : ""}</span>
                      <div className="w-full max-w-10 rounded-t bg-stone-800 transition-[height]" style={{ height: `${Math.max(day.hours ? 8 : 0, (day.hours / maxChartHours) * 150)}px` }} />
                      <span className="pb-2 text-[10px] font-semibold uppercase text-stone-500">{day.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-stone-50 p-3">
                <div><p className="text-xs text-stone-500">Días con actividad</p><p className="mt-1 font-semibold">{chart.filter((day) => day.hours > 0).length}</p></div>
                <div><p className="text-xs text-stone-500">Promedio diario</p><p className="mt-1 font-semibold">{formatDuration(chart.length ? detailHours / chart.length : 0)}</p></div>
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      <p className="mt-3 text-xs leading-5 text-stone-500">El tiempo productivo considera el horario del taller y se calcula entre el inicio y término registrado. Pausas y retrabajos no se muestran porque todavía no cuentan con eventos propios en la base de datos.</p>
    </>
  );
}

function AreaCard({ area, accent, selected, onSelect }: { area: AreaSummary; accent: Accent; selected: boolean; onSelect: () => void }) {
  const Icon = accent.icon;
  return (
    <button type="button" onClick={onSelect} className={cn("panel p-4 text-left transition hover:border-stone-400", selected && "border-stone-950 ring-1 ring-stone-950")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn("grid size-10 place-items-center rounded-full", accent.soft, accent.color)}><Icon className="size-5" /></span>
          <div><h2 className="font-semibold text-stone-950">{area.label}</h2><p className="mt-0.5 text-xs text-stone-500">{area.workers.length} operario{area.workers.length === 1 ? "" : "s"}</p></div>
        </div>
        <ChevronRight className="size-4 text-stone-400" />
      </div>
      <div className="mt-4 grid grid-cols-2 divide-x divide-stone-200">
        <div className="pr-3"><p className="text-xl font-semibold text-stone-950">{area.jobs}</p><p className="text-xs text-stone-500">Trabajos</p></div>
        <div className="pl-4"><p className="text-xl font-semibold text-stone-950">{formatDuration(area.hours)}</p><p className="text-xs text-stone-500">Tiempo productivo</p></div>
      </div>
      <div className="mt-4 border-t border-stone-100 pt-3 text-center"><p className="font-semibold text-stone-900">{area.averageHours === undefined ? "Sin datos" : formatDuration(area.averageHours)}</p><p className="text-xs text-stone-500">Promedio por trabajo</p></div>
      {(area.active || area.blocked) ? <p className="mt-3 text-xs text-stone-500">{area.active} activa{area.active === 1 ? "" : "s"}{area.blocked ? ` · ${area.blocked} bloqueada${area.blocked === 1 ? "" : "s"}` : ""}</p> : null}
    </button>
  );
}

function WorkerArea({ area, accent, selectedArea, selectedWorker, onArea, onWorker }: { area: AreaSummary; accent: Accent; selectedArea?: string; selectedWorker?: string; onArea: () => void; onWorker: (name: string) => void }) {
  return (
    <div className="min-w-0 bg-white">
      <button type="button" onClick={onArea} className={cn("w-full border-b px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em]", accent.color, selectedArea === area.key ? accent.soft : "bg-stone-50")}>
        {area.label}
      </button>
      <div className="divide-y divide-stone-100 px-4">
        {area.workers.map((worker) => (
          <button key={worker.name} type="button" onClick={() => onWorker(worker.name)} className={cn("flex w-full items-center gap-3 py-3 text-left", selectedArea === area.key && selectedWorker === worker.name && "-mx-2 w-[calc(100%+1rem)] rounded-md bg-stone-100 px-2")}>
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold", accent.soft, accent.color)}>{initials(worker.name)}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-stone-950">{worker.name}</span><span className="text-xs text-stone-500">{worker.share}%</span></span>
              <span className="mt-1 flex justify-between gap-2 text-xs text-stone-500"><span>{worker.jobs} trabajos</span><span>{formatDuration(worker.hours)}</span></span>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-stone-100"><span className={cn("block h-full rounded-full", accent.bar)} style={{ width: `${worker.share}%` }} /></span>
            </span>
          </button>
        ))}
        {!area.workers.length ? <p className="py-6 text-center text-xs text-stone-500">Sin operarios asignados.</p> : null}
      </div>
    </div>
  );
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return <div className={cn("border-t border-stone-200 p-4 lg:border-l lg:border-t-0", className)}><p className="text-lg font-semibold text-stone-950">{value}</p><p className="mt-1 text-xs text-stone-500">{label}</p></div>;
}

function EmptyPanel({ message }: { message: string }) {
  return <div className="panel col-span-full p-10 text-center text-sm text-stone-500">{message}</div>;
}

type Accent = { icon: LucideIcon; color: string; soft: string; bar: string };

function completedWork(orders: ReportOrder[], from: Date, to: Date): CompletedWork[] {
  return orders.flatMap((order) => order.steps.flatMap((step, index) => {
    if (!step.startedAt || !step.completedAt) return [];
    const completed = new Date(step.completedAt);
    if (!Number.isFinite(completed.getTime()) || completed < from || completed > to) return [];
    return [{
      id: `${order.id}-${step.key}-${index}`,
      orderCode: order.code,
      client: order.client,
      product: order.product,
      areaKey: step.key,
      areaLabel: step.label,
      owner: step.owner?.trim() || unassigned,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
      hours: workshopHoursBetween(step.startedAt, step.completedAt),
    }];
  })).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

function summarizeAreas(orders: ReportOrder[], users: ReportUser[], work: CompletedWork[]): AreaSummary[] {
  const definitions = new Map<string, string>();
  for (const order of orders) for (const step of order.steps) definitions.set(step.key, step.label);
  for (const user of users) for (const key of user.areas?.length ? user.areas : user.area ? [user.area] : []) if (!definitions.has(key)) definitions.set(key, humanize(key));

  return Array.from(definitions, ([key, label]) => {
    const areaWork = work.filter((item) => item.areaKey === key);
    const roster = new Set(users.filter((user) => user.active && user.role === "operator" && (user.areas ?? (user.area ? [user.area] : [])).includes(key)).map((user) => user.name));
    areaWork.forEach((item) => roster.add(item.owner));
    const hours = sum(areaWork.map((item) => item.hours));
    const workers = Array.from(roster).map((name) => {
      const items = areaWork.filter((item) => item.owner === name);
      const workerHours = sum(items.map((item) => item.hours));
      return { name, jobs: items.length, hours: workerHours, share: hours ? Math.round((workerHours / hours) * 100) : 0 };
    }).sort((a, b) => b.hours - a.hours || b.jobs - a.jobs || a.name.localeCompare(b.name));
    const currentSteps = orders.flatMap((order) => order.steps).filter((step) => step.key === key);
    return {
      key,
      label,
      workers,
      jobs: areaWork.length,
      hours,
      averageHours: areaWork.length ? hours / areaWork.length : undefined,
      active: currentSteps.filter((step) => step.status === "active").length,
      blocked: currentSteps.filter((step) => step.status === "blocked").length,
    };
  })
    .filter((area) => reportAreaRank(area) >= 0)
    .sort((a, b) => reportAreaRank(a) - reportAreaRank(b));
}

function reportAreaRank(area: Pick<AreaSummary, "key" | "label">) {
  const values = [slug(area.key), slug(area.label)];
  return reportAreaOrder.findIndex((aliases) => aliases.some((alias) => values.includes(alias)));
}

function dateRange(period: Period, today: string, customFrom: string, customTo: string) {
  const current = localDate(today);
  let start = current;
  let end = current;
  if (period === "week") {
    const mondayOffset = (current.getDay() + 6) % 7;
    start = addDays(current, -mondayOffset);
    end = addDays(start, 6);
  } else if (period === "month") {
    start = new Date(current.getFullYear(), current.getMonth(), 1);
    end = new Date(current.getFullYear(), current.getMonth() + 1, 0);
  } else if (period === "custom") {
    start = localDate(customFrom || today);
    end = localDate(customTo || customFrom || today);
    if (start > end) [start, end] = [end, start];
  }
  return {
    from: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0),
    to: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999),
    inputFrom: isoDate(start),
    inputTo: isoDate(end),
  };
}

function dailySeries(items: CompletedWork[], from: Date, to: Date) {
  const days: Array<{ date: string; label: string; hours: number }> = [];
  for (let cursor = startOfDay(from); cursor <= to; cursor = addDays(cursor, 1)) {
    const bucketEnd = addDays(cursor, 1);
    const hours = sum(items.filter((item) => {
      const date = new Date(item.completedAt);
      return date >= cursor && date < bucketEnd;
    }).map((item) => item.hours));
    days.push({ date: isoDate(cursor), label: weekday(cursor), hours });
  }
  return days;
}

function exportCsv(items: CompletedWork[], area: string, worker: string | undefined, range: ReturnType<typeof dateRange>) {
  const rows = [
    ["Código", "Cliente", "Producto", "Área", "Operario", "Inicio", "Término", "Horas productivas"],
    ...items.map((item) => [item.orderCode, item.client, item.product, item.areaLabel, item.owner, item.startedAt, item.completedAt, item.hours.toFixed(2)]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `reporte-${slug(area)}${worker ? `-${slug(worker)}` : ""}-${range.inputFrom}-${range.inputTo}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDuration(hours: number, compact = false) {
  if (!Number.isFinite(hours) || hours <= 0) return compact ? "0 h" : "0 h 00 min";
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return compact ? `${wholeHours}h${minutes ? ` ${minutes}m` : ""}` : `${wholeHours} h ${String(minutes).padStart(2, "0")} min`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)).replace(/\u00a0/g, " ");
}

function formatRangeLabel(from: Date, to: Date) {
  const formatter = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", year: "numeric" });
  return isoDate(from) === isoDate(to) ? formatter.format(from) : `${formatter.format(from)} — ${formatter.format(to)}`;
}

function localDate(value: string) { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); }
function isoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function addDays(date: Date, amount: number) { return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount); }
function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function weekday(date: Date) { return new Intl.DateTimeFormat("es-CL", { weekday: "short" }).format(date).replace(".", ""); }
function sum(values: number[]) { return values.reduce((total, value) => total + value, 0); }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function humanize(value: string) { return value.replace(/[_-]+/g, " ").replace(/^./, (letter) => letter.toUpperCase()); }
function csvCell(value: string) { return `"${value.replaceAll('"', '""')}"`; }
function slug(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
