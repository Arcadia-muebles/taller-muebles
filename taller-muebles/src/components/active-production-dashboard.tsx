"use client";

import {
  Armchair,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  CircleDashed,
  Clock3,
  MessageSquare,
  Scissors,
  Search,
  ShieldCheck,
  Sofa,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { closeOrder, moveOrderStage } from "@/app/admin/orders/actions";
import { OrderLabelPrintButton } from "@/components/order-label-print-button";
import { completionPercent, isReadyForDelivery } from "@/lib/metrics";
import type { AreaKey, Order, ProductionStep, StepStatus, SystemSettings } from "@/lib/types";
import { cn, daysUntil, deliveryLabel, formatDate, hasMeaningfulObservations } from "@/lib/utils";

type ActiveProductionDashboardProps = {
  orders: Order[];
  steps: SystemSettings["production"]["steps"];
  canMove: boolean;
};

type DashboardFilter = "all" | "LH" | "LR" | "late" | "today" | "week" | "sewing";
type SortKey = "delivery" | "code" | "progress";
type Tone = "green" | "blue" | "amber" | "purple" | "rose" | "stone";

export function ActiveProductionDashboard({ orders, steps, canMove }: ActiveProductionDashboardProps) {
  const enabledSteps = useMemo(() => steps.filter((step) => step.enabled), [steps]);
  const dashboardSteps = useMemo(() => enabledSteps.filter((step) => !isDashboardHiddenStep(step)), [enabledSteps]);
  const normalizedOrders = useMemo(
    () => orders.map((order) => orderWithConfiguredSteps(order, enabledSteps)),
    [enabledSteps, orders],
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DashboardFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("delivery");
  const [optimisticStage, setOptimisticStage] = useState<Record<string, AreaKey>>({});
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [, startTransition] = useTransition();

  const displayedOrders = useMemo(
    () =>
      normalizedOrders
        .map((order) => {
          const stage = optimisticStage[order.id];
          return stage ? orderWithStage(order, stage) : order;
        })
        .filter((order) => matchesFilter(order, filter))
        .filter((order) => matchesSearch(order, search))
        .sort((a, b) => sortOrders(a, b, sortKey)),
    [filter, normalizedOrders, optimisticStage, search, sortKey],
  );

  const counters = useMemo(() => buildCounters(normalizedOrders, dashboardSteps), [dashboardSteps, normalizedOrders]);

  function move(order: Order, stepKey: AreaKey) {
    const current = currentStep(order);
    if (!canMove || current?.key === stepKey || order.status === "completed" || order.status === "cancelled") return;

    setFeedback(null);
    setOptimisticStage((currentStages) => ({ ...currentStages, [order.id]: stepKey }));
    startTransition(async () => {
      const result = await moveOrderStage({ orderId: order.id, stepKey });
      if (!result.ok) {
        setOptimisticStage((currentStages) => {
          const next = { ...currentStages };
          delete next[order.id];
          return next;
        });
        setFeedback({ tone: "error", message: result.message });
        return;
      }
      setFeedback({ tone: "success", message: "Proceso actualizado." });
    });
  }

  return (
    <section className="mt-5 space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(7,minmax(0,1fr))]">
        <MetricCard
          label="Notas activas"
          value={String(normalizedOrders.length)}
          helper={`LH: ${counters.lh} / LR: ${counters.lr}`}
          icon={CheckCircle2}
          tone="green"
        />
        {counters.byStep.map((item) => (
          <MetricCard
            key={item.key}
            label={metricStepLabel(item.label)}
            value={String(item.count)}
            helper={item.key === "sewing" && item.count > 0 ? "Cuello de botella" : ""}
            icon={stepIconByKey(item.key, item.label)}
            tone={stepTone({ key: item.key, label: item.label })}
          />
        ))}
        <MetricCard
          label="Atrasadas"
          value={String(counters.late)}
          helper={normalizedOrders.length ? `${Math.round((counters.late / normalizedOrders.length) * 100)}% del total` : "Sin atrasos"}
          icon={Clock3}
          tone={counters.late ? "rose" : "stone"}
        />
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-stone-200 p-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="-mx-1 flex min-w-0 flex-nowrap gap-1.5 overflow-x-auto px-1 pb-1">
              <FilterChip active={filter === "all"} label="Todos" count={normalizedOrders.length} onClick={() => setFilter("all")} />
              <FilterChip active={filter === "LH"} label="LH" count={counters.lh} onClick={() => setFilter("LH")} />
              <FilterChip active={filter === "LR"} label="LR" count={counters.lr} onClick={() => setFilter("LR")} />
              <FilterChip active={filter === "late"} label="Atrasados" count={counters.late} tone="rose" onClick={() => setFilter("late")} />
              <FilterChip active={filter === "today"} label="Vencen hoy" count={counters.today} tone="amber" onClick={() => setFilter("today")} />
              <FilterChip active={filter === "week"} label="Esta semana" count={counters.week} tone="amber" onClick={() => setFilter("week")} />
              <FilterChip active={filter === "sewing"} label="En costura" count={counters.sewing} tone="purple" onClick={() => setFilter("sewing")} />
            </div>

            <div className="flex min-w-0 flex-col gap-2 sm:flex-row xl:w-[500px]">
              <label className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por codigo, cliente o producto..."
                  className="control pl-9"
                />
              </label>
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="control bg-white text-stone-700 sm:w-44">
                <option value="delivery">Entrega cercana</option>
                <option value="code">Codigo</option>
                <option value="progress">Avance</option>
              </select>
            </div>
          </div>
          {feedback ? (
            <div
              className={cn(
                "mt-3 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm font-medium",
                feedback.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800",
              )}
            >
              <span>{feedback.message}</span>
              <button type="button" onClick={() => setFeedback(null)} aria-label="Ocultar mensaje" className="grid size-6 place-items-center rounded hover:bg-white/60">
                <X className="size-3.5" />
              </button>
            </div>
          ) : null}
        </div>

        <div className="overflow-x-auto bg-stone-50/70 p-1.5">
          <table className="w-full min-w-[920px] table-fixed border-separate border-spacing-y-1">
            <colgroup>
              <col className="w-[145px]" />
              <col className="w-[190px]" />
              <col className="w-[75px]" />
              <col className="w-[220px]" />
              <col className="w-[120px]" />
              <col className="w-[100px]" />
              <col className="w-[70px]" />
            </colgroup>
            <thead>
              <tr>
                <HeaderCell>Codigo / cliente</HeaderCell>
                <HeaderCell>Producto</HeaderCell>
                <HeaderCell>Color</HeaderCell>
                <HeaderCell className="text-center">Procesos</HeaderCell>
                <HeaderCell>Estado actual</HeaderCell>
                <HeaderCell>Entrega</HeaderCell>
                <HeaderCell>Avance</HeaderCell>
              </tr>
              <tr>
                <th />
                <th />
                <th />
                <th className="px-3 pb-2">
                  <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(dashboardSteps.length, 1)}, minmax(30px, 1fr))` }}>
                    {dashboardSteps.map((step) => (
                      <span
                        key={step.key}
                        title={step.label}
                        className="whitespace-nowrap text-center text-[9px] font-semibold uppercase leading-none tracking-[0.04em] text-stone-500"
                      >
                        {processColumnLabel(step.label)}
                      </span>
                    ))}
                  </div>
                </th>
                <th />
                <th />
                <th />
              </tr>
            </thead>
            <tbody>
              {displayedOrders.map((order) => {
                const presentation = statusPresentation(order);
                const StatusIcon = presentation.icon;
                const progress = completionPercent(order);
                const groupOrders = normalizedOrders.filter((item) => item.groupCode === order.groupCode);
                return (
                  <tr key={order.id} className="group">
                    <BodyCell className="rounded-l-lg border-l">
                      <div className="flex min-w-0 items-start gap-2">
                        <Link href={`/admin/orders/${order.id}`} aria-label={`Abrir orden ${order.code}`} className="shrink-0">
                          <StoreStripe store={order.store} />
                        </Link>
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <Link href={`/admin/orders/${order.id}`} className="min-w-0">
                              <p className="truncate text-lg font-semibold text-stone-950 group-hover:underline">{order.code}</p>
                            </Link>
                            <OrderLabelPrintButton order={order} groupOrders={groupOrders} compact />
                            <ObservationAlert order={order} />
                          </div>
                          <Link href={`/admin/orders/${order.id}`} className="block min-w-0">
                            <p className="mt-1 truncate text-xs font-medium text-stone-600">{order.store === "LH" ? "Leather House" : "La Reina"}</p>
                            <p className="mt-0.5 truncate text-xs text-stone-500">{order.client}</p>
                          </Link>
                        </div>
                      </div>
                    </BodyCell>
                    <BodyCell>
                      <p className="line-clamp-2 text-xs font-semibold uppercase leading-5 text-stone-950">{order.product}</p>
                      <p className="mt-1 truncate text-[11px] font-medium uppercase tracking-[0.04em] text-stone-500">Pedido {order.groupCode}</p>
                    </BodyCell>
                    <BodyCell>
                      <p title={order.color || "Sin color"} className="line-clamp-2 break-words text-xs font-semibold leading-4 text-stone-900">
                        {order.color || "Sin color"}
                      </p>
                    </BodyCell>
                    <BodyCell className="text-center">
                      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(dashboardSteps.length, 1)}, minmax(30px, 1fr))` }}>
                        {dashboardSteps.map((step) => {
                          const orderStep = order.steps.find((item) => item.key === step.key);
                          return (
                            <StepDot
                              key={step.key}
                              order={order}
                              step={orderStep ?? { key: step.key, label: step.label, owner: step.label, status: "pending" }}
                              canMove={canMove}
                              onMove={() => move(order, step.key)}
                            />
                          );
                        })}
                      </div>
                    </BodyCell>
                    <BodyCell>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className={cn("inline-flex max-w-full items-center gap-1.5 rounded-md border px-2.5 py-2 text-[11px] font-semibold uppercase leading-none", tonePill(presentation.tone))}>
                          <StatusIcon className="size-4 shrink-0" />
                          <span className="truncate">{presentation.label}</span>
                        </span>
                        {canMove && canCloseOrder(order) ? (
                          <form action={closeOrder}>
                            <input type="hidden" name="orderId" value={order.id} />
                            <button
                              type="submit"
                              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-stone-950 px-2.5 text-[11px] font-semibold uppercase text-white transition hover:bg-stone-800"
                            >
                              <Truck className="size-3.5" />
                              Entregar
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </BodyCell>
                    <BodyCell>
                      <DeliveryBlock order={order} />
                    </BodyCell>
                    <BodyCell className="rounded-r-lg border-r">
                      <p className="mb-1 text-xs font-semibold text-stone-900">{progress}%</p>
                      <div className="h-2.5 w-16 overflow-hidden rounded-full bg-stone-200">
                        <div className={cn("h-full rounded-full", toneBar(presentation.tone))} style={{ width: `${progress}%` }} />
                      </div>
                    </BodyCell>
                  </tr>
                );
              })}
              {!displayedOrders.length ? (
                <tr>
                  <td colSpan={7} className="rounded-lg border border-dashed border-stone-200 bg-white px-4 py-10 text-center text-sm text-stone-500">
                    No hay notas activas que coincidan con los filtros.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="border-t border-stone-200 px-4 py-2.5 text-xs text-stone-500">
          Mostrando {displayedOrders.length} de {normalizedOrders.length} notas activas
        </div>
      </section>
    </section>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
  className,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ElementType;
  tone: Tone;
  className?: string;
}) {
  return (
    <section className={cn("min-h-18 rounded-lg border bg-white p-2.5", metricTone(tone), className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xl font-semibold leading-none tracking-tight">{value}</p>
          <p className="mt-2 truncate text-xs font-semibold">{label}</p>
        </div>
        <Icon className="size-4 shrink-0" />
      </div>
      {helper ? <p className="mt-2 truncate text-xs font-medium text-current/70">{helper}</p> : null}
    </section>
  );
}

function FilterChip({
  active,
  label,
  count,
  tone = "stone",
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  tone?: Tone;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-xs font-semibold transition",
        active ? "border-stone-950 bg-stone-950 text-white" : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:text-stone-950",
      )}
    >
      <span>{label}</span>
      <span className={cn("grid min-w-5 place-items-center rounded-full px-1.5 py-0.5 text-[10px]", active ? "bg-white/15 text-white" : chipTone(tone))}>
        {count}
      </span>
    </button>
  );
}

function StepDot({ order, step, canMove, onMove }: { order: Order; step: ProductionStep; canMove: boolean; onMove: () => void }) {
  const disabled = !canMove || order.status === "completed" || order.status === "cancelled";
  const Icon = step.status === "done" ? Check : step.status === "active" ? Circle : step.status === "blocked" ? X : Circle;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onMove}
      title={disabled ? step.label : `Mover a ${step.label}`}
      aria-label={disabled ? `${step.label}: ${step.status}` : `Mover ${order.code} a ${step.label}`}
      className={cn(
        "mx-auto grid size-6 place-items-center rounded-md border transition",
        stepDotClass(step.status, stepTone(step)),
        !disabled && "hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-sm",
        disabled && "cursor-default opacity-80",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

function HeaderCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("whitespace-nowrap px-2 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500", className)}>
      {children}
    </th>
  );
}

function BodyCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn("border-y border-stone-200 bg-white px-2 py-2.5 align-middle text-sm shadow-sm transition group-hover:bg-stone-50", className)}>
      {children}
    </td>
  );
}

function StoreStripe({ store }: { store: Order["store"] }) {
  return (
    <span className={cn("mt-1 h-12 w-2 shrink-0 rounded-full", store === "LH" ? "bg-amber-700" : "bg-blue-700")} aria-hidden />
  );
}

function DeliveryBlock({ order }: { order: Order }) {
  const days = daysUntil(order.deliveryDate);
  const late = days < 0;
  return (
    <div className="min-w-0">
      <p className="inline-flex items-center gap-1 text-xs font-semibold text-stone-900">
        <CalendarDays className="size-3.5 text-stone-400" />
        {formatDate(order.deliveryDate)}
      </p>
      <p className={cn("mt-1 text-xs font-semibold", late ? "text-rose-700" : days <= 7 ? "text-amber-700" : "text-emerald-700")}>
        {deliveryLabel(order.deliveryDate, false)}
      </p>
    </div>
  );
}

function ObservationAlert({ order }: { order: Order }) {
  if (!hasMeaningfulObservations(order.observations)) return null;
  return (
    <Link
      href={`/admin/orders/${order.id}#observaciones`}
      title="Ver observacion"
      aria-label={`Ver observacion de ${order.code}`}
      className="grid size-5 shrink-0 place-items-center rounded-full border border-amber-200 bg-amber-50 text-amber-700"
    >
      <MessageSquare className="size-3" />
    </Link>
  );
}

function buildCounters(orders: Order[], steps: SystemSettings["production"]["steps"]) {
  const byStep = steps.map((step) => ({
    key: step.key,
    label: step.label,
    count: orders.filter((order) => currentStep(order)?.key === step.key).length,
  }));
  return {
    lh: orders.filter((order) => order.store === "LH").length,
    lr: orders.filter((order) => order.store === "LR").length,
    late: orders.filter((order) => daysUntil(order.deliveryDate) < 0).length,
    today: orders.filter((order) => daysUntil(order.deliveryDate) === 0).length,
    week: orders.filter((order) => daysUntil(order.deliveryDate) >= 0 && daysUntil(order.deliveryDate) <= 7).length,
    sewing: orders.filter((order) => currentStep(order)?.key === "sewing").length,
    byStep,
  };
}

function isDashboardHiddenStep(step: Pick<ProductionStep, "key" | "label">) {
  const normalized = `${step.key} ${step.label}`.toLowerCase();
  return normalized.includes("en_blanco") || normalized.includes("blanco") || normalized.includes("quality") || normalized.includes("calidad");
}

function matchesFilter(order: Order, filter: DashboardFilter) {
  const days = daysUntil(order.deliveryDate);
  if (filter === "LH" || filter === "LR") return order.store === filter;
  if (filter === "late") return days < 0;
  if (filter === "today") return days === 0;
  if (filter === "week") return days >= 0 && days <= 7;
  if (filter === "sewing") return currentStep(order)?.key === "sewing";
  return true;
}

function matchesSearch(order: Order, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [order.code, order.client, order.product, order.material, order.color, order.groupCode]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(query));
}

function sortOrders(a: Order, b: Order, sortKey: SortKey) {
  if (sortKey === "code") return a.code.localeCompare(b.code);
  if (sortKey === "progress") return completionPercent(a) - completionPercent(b);
  return a.deliveryDate.localeCompare(b.deliveryDate);
}

function statusPresentation(order: Order): { label: string; tone: Tone; icon: React.ElementType } {
  if (order.status === "completed") return { label: "Entregada", tone: "green", icon: CheckCircle2 };
  if (order.status === "blocked" || order.steps.some((step) => step.status === "blocked")) return { label: "Bloqueada", tone: "rose", icon: CircleDashed };
  if (isReadyForDelivery(order)) return { label: "Listo para entrega", tone: "green", icon: CheckCircle2 };
  const step = currentStep(order);
  if (!step) return { label: "Sin iniciar", tone: "stone", icon: Clock3 };
  return { label: currentStepStatusLabel(step), tone: stepTone(step), icon: stepIconByKey(step.key, step.label) };
}

function currentStep(order: Order) {
  return (
    order.steps.find((step) => step.status === "active") ??
    order.steps.find((step) => step.status === "blocked") ??
    order.steps.find((step) => step.status === "pending")
  );
}

function canCloseOrder(order: Order) {
  if (order.status === "completed" || order.status === "cancelled" || !order.steps.length) return false;
  if (order.steps.every((step) => step.status === "done")) return true;

  const lastStep = order.steps.at(-1);
  if (!lastStep || lastStep.status === "blocked") return false;
  return order.steps.slice(0, -1).every((step) => step.status === "done");
}

function orderWithStage(order: Order, stepKey: AreaKey): Order {
  const targetIndex = order.steps.findIndex((step) => step.key === stepKey);
  if (targetIndex < 0) return order;
  return {
    ...order,
    steps: order.steps.map((step, index) => {
      if (index < targetIndex) return { ...step, status: "done" };
      if (index === targetIndex) return { ...step, status: "pending", startedAt: undefined, completedAt: undefined };
      return { ...step, status: "pending", startedAt: undefined, completedAt: undefined };
    }),
  };
}

function orderWithConfiguredSteps(order: Order, enabledSteps: SystemSettings["production"]["steps"]): Order {
  if (!enabledSteps.length) return order;

  const existingByKey = new Map(order.steps.map((step) => [step.key, step]));
  const configuredKeys = new Set(enabledSteps.map((step) => step.key));
  const current = currentStep(order);
  const currentConfiguredIndex = current ? enabledSteps.findIndex((step) => step.key === current.key) : -1;
  const completed = order.status === "completed" || order.steps.every((step) => step.status === "done");

  return {
    ...order,
    steps: [
      ...enabledSteps.map((stepConfig, index) => {
        const existing = existingByKey.get(stepConfig.key);
        if (existing) return { ...existing, label: existing.label || stepConfig.label };
        return {
          key: stepConfig.key,
          label: stepConfig.label,
          owner: stepConfig.label,
          status: completed || (currentConfiguredIndex >= 0 && index < currentConfiguredIndex) ? "done" as StepStatus : "pending" as StepStatus,
        };
      }),
      ...order.steps.filter((step) => !configuredKeys.has(step.key)),
    ],
  };
}

function cleanStepLabel(label: string) {
  return label.replace(/^en\s+/i, "").toLowerCase();
}

function metricStepLabel(label: string) {
  const clean = label.trim();
  if (/despacho|terminado/i.test(clean)) return "Terminado";
  if (/^en\s+/i.test(clean)) return clean;
  return `En ${clean}`;
}

function currentStepStatusLabel(step: Pick<ProductionStep, "key" | "label">) {
  const normalized = `${step.key} ${step.label}`;
  if (/dispatch|despacho|terminado/i.test(normalized)) return "Terminado";
  return `En ${cleanStepLabel(step.label)}`;
}

function processColumnLabel(label: string) {
  const normalized = label
    .replace(/^en\s+/i, "")
    .replace(/revision de calidad/i, "Calidad")
    .trim();
  if (/estructura/i.test(normalized)) return "Est";
  if (/blanco/i.test(normalized)) return "Blanco";
  if (/corte/i.test(normalized)) return "Cor";
  if (/costura/i.test(normalized)) return "Cos";
  if (/tapicer/i.test(normalized)) return "Tap";
  if (/calidad/i.test(normalized)) return "Calidad";
  if (/despacho|terminado/i.test(normalized)) return "Ter";
  return normalized.slice(0, 3);
}

function stepIconByKey(key: string, label: string) {
  const normalized = `${key} ${label}`.toLowerCase();
  if (normalized.includes("cut") || normalized.includes("corte")) return Scissors;
  if (normalized.includes("quality") || normalized.includes("calidad")) return ShieldCheck;
  if (normalized.includes("dispatch") || normalized.includes("despacho")) return Truck;
  if (normalized.includes("upholstery") || normalized.includes("tapicer")) return Armchair;
  return Sofa;
}

function stepTone(step: Pick<ProductionStep, "key" | "label">): Tone {
  const normalized = `${step.key} ${step.label}`.toLowerCase();
  if (normalized.includes("cut") || normalized.includes("corte")) return "blue";
  if (normalized.includes("structure") || normalized.includes("estructura")) return "amber";
  if (normalized.includes("quality") || normalized.includes("calidad") || normalized.includes("dispatch") || normalized.includes("despacho")) return "green";
  if (normalized.includes("upholstery") || normalized.includes("tapicer")) return "purple";
  if (normalized.includes("sewing") || normalized.includes("costura")) return "rose";
  return "stone";
}

function stepDotClass(status: StepStatus, tone: Tone) {
  if (status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "blocked") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "active") return tonePill(tone);
  return "border-stone-200 bg-white text-stone-500";
}

function tonePill(tone: Tone) {
  const classes: Record<Tone, string> = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    blue: "border-sky-200 bg-sky-50 text-sky-800",
    amber: "border-orange-200 bg-orange-50 text-orange-700",
    purple: "border-violet-200 bg-violet-50 text-violet-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    stone: "border-stone-200 bg-stone-50 text-stone-700",
  };
  return classes[tone];
}

function toneBar(tone: Tone) {
  const classes: Record<Tone, string> = {
    green: "bg-emerald-600",
    blue: "bg-sky-500",
    amber: "bg-orange-500",
    purple: "bg-violet-500",
    rose: "bg-rose-500",
    stone: "bg-stone-500",
  };
  return classes[tone];
}

function metricTone(tone: Tone) {
  const classes: Record<Tone, string> = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    blue: "border-sky-200 bg-sky-50 text-sky-900",
    amber: "border-orange-200 bg-orange-50 text-orange-900",
    purple: "border-violet-200 bg-violet-50 text-violet-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    stone: "border-stone-200 bg-white text-stone-900",
  };
  return classes[tone];
}

function chipTone(tone: Tone) {
  const classes: Record<Tone, string> = {
    green: "bg-emerald-100 text-emerald-700",
    blue: "bg-sky-100 text-sky-700",
    amber: "bg-orange-100 text-orange-700",
    purple: "bg-violet-100 text-violet-700",
    rose: "bg-rose-100 text-rose-700",
    stone: "bg-stone-100 text-stone-600",
  };
  return classes[tone];
}
