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
  Pencil,
  Printer,
  Scissors,
  Search,
  ShieldCheck,
  Sofa,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { moveOrderStage, updateOrderObservation } from "@/app/admin/orders/actions";
import { updateProductionStep } from "@/app/taller/actions";
import { OrderLabelPrintButton } from "@/components/order-label-print-button";
import { completionPercent, isReadyForDelivery } from "@/lib/metrics";
import { compareOrderGroupMembers, isIndependentStartStep, isProductionOrder, orderGroupPositions, productionOrderGroup, productionStepPrerequisitesMet } from "@/lib/orders";
import type { AreaKey, Order, ProductionStep, StepStatus, StructureRequest, SystemSettings } from "@/lib/types";
import { cn, daysUntil, deliveryLabel, formatDate, hasMeaningfulObservations } from "@/lib/utils";

type ActiveProductionDashboardProps = {
  orders: Order[];
  steps: SystemSettings["production"]["steps"];
  canMove: boolean;
  structureRequests?: StructureRequest[];
  finishedCount?: number;
};

type DashboardFilter = "all" | "active";
type SortKey = "recent" | "delivery" | "code" | "progress";
type Tone = "green" | "blue" | "amber" | "purple" | "rose" | "stone";
type DashboardColumnKey = "code" | "product" | "color" | "process" | "status" | "delivery" | "progress";
type OptimisticStepStatus = { status: StepStatus; previousStatus: StepStatus };

const ORDERS_PER_PAGE = 30;

const dashboardColumns: Array<{
  key: DashboardColumnKey;
  label: string;
  width: number;
  min: number;
  max: number;
  align?: "left" | "center";
}> = [
  { key: "code", label: "Codigo / cliente", width: 145, min: 120, max: 280 },
  { key: "product", label: "Producto", width: 190, min: 150, max: 420 },
  { key: "color", label: "Color", width: 75, min: 65, max: 170 },
  { key: "process", label: "Procesos", width: 220, min: 190, max: 460, align: "center" },
  { key: "status", label: "Estado actual", width: 120, min: 110, max: 260 },
  { key: "delivery", label: "Entrega", width: 100, min: 90, max: 190 },
  { key: "progress", label: "Avance", width: 70, min: 65, max: 130 },
];

const defaultColumnWidths = Object.fromEntries(dashboardColumns.map((column) => [column.key, column.width])) as Record<DashboardColumnKey, number>;

export function ActiveProductionDashboard({ orders, steps, canMove, structureRequests = [], finishedCount = 0 }: ActiveProductionDashboardProps) {
  const enabledSteps = useMemo(() => steps.filter((step) => step.enabled), [steps]);
  const dashboardSteps = useMemo(() => enabledSteps.filter((step) => !isDashboardHiddenStep(step)), [enabledSteps]);
  const normalizedOrders = useMemo(
    () => orders.map((order) => orderWithConfiguredSteps(order, enabledSteps)),
    [enabledSteps, orders],
  );
  const groupPositions = useMemo(() => orderGroupPositions(normalizedOrders), [normalizedOrders]);
  const dashboardOrders = useMemo(
    () => normalizedOrders.filter(isDashboardVisibleOrder),
    [normalizedOrders],
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DashboardFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("delivery");
  const [page, setPage] = useState(1);
  const [optimisticStage, setOptimisticStage] = useState<Record<string, AreaKey>>({});
  const [optimisticStepStatuses, setOptimisticStepStatuses] = useState<Record<string, OptimisticStepStatus>>({});
  const [pendingStepStatuses, setPendingStepStatuses] = useState<Record<string, true>>({});
  const [columnWidths, setColumnWidths] = useState<Record<DashboardColumnKey, number>>(defaultColumnWidths);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [, startTransition] = useTransition();

  const optimisticOrders = useMemo(
    () => dashboardOrders.map((order) => {
      const stage = optimisticStage[order.id];
      const stagedOrder = stage ? orderWithStage(order, stage) : order;
      return orderWithStepStatuses(stagedOrder, optimisticStepStatuses);
    }),
    [dashboardOrders, optimisticStage, optimisticStepStatuses],
  );
  const activeOrders = useMemo(
    () => optimisticOrders.filter(isDashboardActiveOrder),
    [optimisticOrders],
  );

  const displayedOrders = useMemo(
    () =>
      optimisticOrders
        .filter((order) => matchesFilter(order, filter))
        .filter((order) => matchesSearch(order, search))
        .sort((a, b) => sortOrders(a, b, sortKey, dashboardSteps)),
    [dashboardSteps, filter, optimisticOrders, search, sortKey],
  );

  const totalPages = Math.max(1, Math.ceil(displayedOrders.length / ORDERS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedOrders = useMemo(
    () => displayedOrders.slice((currentPage - 1) * ORDERS_PER_PAGE, currentPage * ORDERS_PER_PAGE),
    [currentPage, displayedOrders],
  );
  const pageNumbers = useMemo(() => visiblePageNumbers(currentPage, totalPages), [currentPage, totalPages]);

  const counters = useMemo(() => buildCounters(activeOrders, enabledSteps.filter((step) => !isDashboardMetricHiddenStep(step)), finishedCount), [activeOrders, enabledSteps, finishedCount]);
  const requestedStructureOrders = useMemo(
    () => new Set(structureRequests.filter((request) => request.status === "requested" || request.status === "in_progress").map((request) => request.orderId)),
    [structureRequests],
  );
  const tableWidth = useMemo(() => dashboardColumns.reduce((total, column) => total + columnWidths[column.key], 0), [columnWidths]);

  function move(order: Order, stepKey: AreaKey) {
    const current = currentStep(order);
    const target = order.steps.find((step) => step.key === stepKey);
    const statusKey = optimisticStepStatusKey(order.id, stepKey);
    if (!canMove || order.status === "completed" || order.status === "cancelled") return;
    if (pendingStepStatuses[statusKey]) return;

    if (target && isIndependentStartStep(stepKey)) {
      const nextStatus = target.status === "active" ? "done" : target.status === "done" ? "pending" : "active";
      updateStepStatus(order.id, stepKey, target.status, nextStatus);
      return;
    }

    if (current?.key === stepKey) {
      if (current.status === "active") {
        updateStepStatus(order.id, stepKey, current.status, "done");
        return;
      }
      if (current.status !== "pending" || !isWaitingForStep(order, current)) return;
      updateStepStatus(order.id, stepKey, current.status, "active");
      return;
    }

    setFeedback(null);
    setOptimisticStepStatuses((currentStatuses) => removeOrderStepStatuses(currentStatuses, order.id));
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
    });
  }

  function updateStepStatus(orderId: string, stepKey: AreaKey, previousStatus: StepStatus, status: StepStatus) {
    const statusKey = optimisticStepStatusKey(orderId, stepKey);
    const persistedStatus = dashboardOrders
      .find((order) => order.id === orderId)
      ?.steps.find((step) => step.key === stepKey)
      ?.status ?? previousStatus;
    if (pendingStepStatuses[statusKey]) return;
    setFeedback(null);
    setOptimisticStage((currentStages) => {
      const next = { ...currentStages };
      delete next[orderId];
      return next;
    });
    setOptimisticStepStatuses((currentStatuses) => ({
      ...currentStatuses,
      [statusKey]: { status, previousStatus: persistedStatus },
    }));
    setPendingStepStatuses((currentStatuses) => ({ ...currentStatuses, [statusKey]: true }));
    startTransition(async () => {
      try {
        const result = await updateProductionStep({ orderId, stepKey, status });
        if (result.status !== "error") {
          return;
        }
        setOptimisticStepStatuses((currentStatuses) => {
          const next = { ...currentStatuses };
          delete next[statusKey];
          return next;
        });
        setFeedback({ tone: "error", message: result.message });
      } catch {
        setOptimisticStepStatuses((currentStatuses) => {
          const next = { ...currentStatuses };
          delete next[statusKey];
          return next;
        });
        setFeedback({ tone: "error", message: "No fue posible guardar el proceso. Intenta nuevamente." });
      } finally {
        setPendingStepStatuses((currentStatuses) => {
          const next = { ...currentStatuses };
          delete next[statusKey];
          return next;
        });
      }
    });
  }

  function updateFilter(nextFilter: DashboardFilter) {
    setFilter(nextFilter);
    setPage(1);
  }

  function startColumnResize(event: React.PointerEvent<HTMLButtonElement>, columnKey: DashboardColumnKey) {
    const column = dashboardColumns.find((item) => item.key === columnKey);
    if (!column) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = columnWidths[columnKey];
    const minWidth = column.min;
    const maxWidth = column.max;

    function resize(pointerEvent: PointerEvent) {
      const nextWidth = clamp(startWidth + pointerEvent.clientX - startX, minWidth, maxWidth);
      setColumnWidths((current) => ({ ...current, [columnKey]: nextWidth }));
    }

    function stopResize() {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    }

    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stopResize, { once: true });
    window.addEventListener("pointercancel", stopResize, { once: true });
  }

  function resetColumnWidth(columnKey: DashboardColumnKey) {
    const column = dashboardColumns.find((item) => item.key === columnKey);
    if (!column) return;
    setColumnWidths((current) => ({ ...current, [columnKey]: column.width }));
  }

  return (
    <section className="mt-5 space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(6,minmax(0,1fr))]">
        {counters.byStep.map((item) => (
          <MetricCard
            key={item.key}
            label={metricStepLabel(item.label)}
            value={String(item.count)}
            helper=""
            icon={stepIconByKey(item.key, item.label)}
            tone={stepTone({ key: item.key, label: item.label })}
          />
        ))}
        <MetricCard
          label="Atrasadas"
          value={String(counters.late)}
          helper={counters.late ? "Revisar fecha" : ""}
          icon={Clock3}
          tone={counters.late ? "rose" : "stone"}
        />
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-stone-200 p-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="-mx-1 flex min-w-0 flex-nowrap gap-1.5 overflow-x-auto px-1 pb-1">
              <FilterChip active={filter === "all"} label="Todos" count={dashboardOrders.length} onClick={() => updateFilter("all")} />
              <FilterChip active={filter === "active"} label="Activos" count={activeOrders.length} onClick={() => updateFilter("active")} />
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950"
              >
                <Printer className="size-3.5" />
                Imprimir lista
              </button>
            </div>

            <div className="flex min-w-0 flex-col gap-2 sm:flex-row xl:w-[500px]">
              <label className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Buscar por código, cliente o producto..."
                  className="control pl-9"
                />
              </label>
              <select
                value={sortKey}
                onChange={(event) => {
                  setSortKey(event.target.value as SortKey);
                  setPage(1);
                }}
                className="control bg-white text-stone-700 sm:w-44"
              >
                <option value="recent">Ingreso reciente</option>
                <option value="delivery">Entrega cercana</option>
                <option value="code">Código</option>
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
          <table className="w-full table-fixed border-separate border-spacing-y-1" style={{ minWidth: tableWidth }}>
            <colgroup>
              {dashboardColumns.map((column) => (
                <col key={column.key} style={{ width: columnWidths[column.key] }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {dashboardColumns.map((column) => (
                  <HeaderCell
                    key={column.key}
                    className={column.align === "center" ? "text-center" : undefined}
                    onResize={(event) => startColumnResize(event, column.key)}
                    onReset={() => resetColumnWidth(column.key)}
                  >
                    {column.label}
                  </HeaderCell>
                ))}
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
              {paginatedOrders.map((order) => {
                const presentation = statusPresentation(order);
                const StatusIcon = presentation.icon;
                const progress = dashboardCompletionPercent(order, dashboardSteps);
                const groupOrders = productionOrderGroup(normalizedOrders, order);
                const groupPosition = groupPositions.get(order.id);
                return (
                  <tr key={order.id} className={cn("group", orderRowClass(order))}>
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
                            <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-stone-500">
                              <span className="truncate">{order.client}</span>
                              {groupPosition ? (
                                <span className="shrink-0 rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-stone-700">
                                  {groupPosition.index}/{groupPosition.total}
                                </span>
                              ) : null}
                            </p>
                          </Link>
                        </div>
                      </div>
                    </BodyCell>
                    <BodyCell>
                      <p className="whitespace-normal break-words text-xs font-semibold uppercase leading-5 text-stone-950">{order.product}</p>
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
                              requested={step.key === "structure" && requestedStructureOrders.has(order.id)}
                              canMove={canMove}
                              pending={Boolean(pendingStepStatuses[optimisticStepStatusKey(order.id, step.key)])}
                              onMove={() => move(order, step.key)}
                            />
                          );
                        })}
                      </div>
                    </BodyCell>
                    <BodyCell>
                      <div className="flex min-w-0 items-center">
                        <span className={cn("inline-flex max-w-full items-start gap-1.5 rounded-md border px-2.5 py-2 text-[11px] font-semibold uppercase", tonePill(presentation.tone))}>
                          <StatusIcon className="mt-0.5 size-4 shrink-0" />
                          <span className="whitespace-normal break-words leading-4">{presentation.label}</span>
                        </span>
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
                    {filter === "active" ? "No hay notas activas que coincidan con los filtros." : "No hay notas que coincidan con los filtros."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-stone-200 px-4 py-3 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <span>{paginationLabel(displayedOrders.length, currentPage)}</span>
          {totalPages > 1 ? (
            <nav className="flex items-center gap-1" aria-label="Paginación de notas">
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} className="pagination-button">
                Anterior
              </button>
              {pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  aria-current={pageNumber === currentPage ? "page" : undefined}
                  className={cn("pagination-button min-w-8", pageNumber === currentPage && "border-stone-950 bg-stone-950 text-white")}
                >
                  {pageNumber}
                </button>
              ))}
              <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages} className="pagination-button">
                Siguiente
              </button>
            </nav>
          ) : null}
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

function StepDot({
  order,
  step,
  requested,
  canMove,
  pending,
  onMove,
}: {
  order: Order;
  step: ProductionStep;
  requested?: boolean;
  canMove: boolean;
  pending: boolean;
  onMove: () => void;
}) {
  const disabled = pending || !canMove || order.status === "completed" || order.status === "cancelled";
  const waiting = isWaitingForStep(order, step);
  const requestedAndPending = requested && step.status === "pending";
  const directAction = step.status === "active"
      ? `Marcar ${step.label} como listo`
      : isIndependentStartStep(step.key)
        ? step.status === "done"
          ? `Reabrir ${step.label}`
          : `Iniciar ${step.label}`
        : undefined;
  const Icon = step.status === "done" ? Check : step.status === "active" ? Circle : step.status === "blocked" ? X : Circle;
  return (
    <button
      type="button"
      data-order-id={order.id}
      data-step-key={step.key}
      data-step-status={step.status}
      disabled={disabled}
      onClick={onMove}
      title={directAction ?? (requestedAndPending ? `${step.label}: solicitada, pendiente` : waiting ? `${step.label}: disponible para iniciar` : disabled ? step.label : `Mover a ${step.label}`)}
      aria-label={directAction ? `${directAction} para ${order.code}` : requestedAndPending ? `${step.label}: solicitada, pendiente` : disabled ? `${step.label}: ${step.status}` : `Mover ${order.code} a ${step.label}`}
      className={cn(
        "production-process-indicator mx-auto grid size-6 place-items-center rounded-md border transition",
        requestedAndPending ? "border-amber-300 bg-amber-50 text-amber-700" : stepDotClass(step.status, stepTone(step)),
        !disabled && "hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-sm",
        disabled && "cursor-default opacity-60",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

function HeaderCell({
  children,
  className,
  onResize,
  onReset,
}: {
  children: React.ReactNode;
  className?: string;
  onResize?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onReset?: () => void;
}) {
  return (
    <th className={cn("group/header relative whitespace-nowrap px-2 py-3 pr-4 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500", className)}>
      <span className="block truncate">{children}</span>
      {onResize ? (
        <button
          type="button"
          aria-label={`Ajustar ancho de ${children}`}
          title="Arrastrar para ajustar. Doble click para restaurar."
          onPointerDown={onResize}
          onDoubleClick={onReset}
          className="absolute top-1/2 right-0 h-6 w-3 -translate-y-1/2 cursor-col-resize touch-none rounded-sm outline-none transition hover:bg-stone-200 focus-visible:bg-stone-200"
        >
          <span className="mx-auto block h-5 w-px bg-stone-300 group-hover/header:bg-stone-500" />
        </button>
      ) : null}
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

function orderRowClass(order: Order) {
  if (order.status === "completed") {
    return "[&_td]:border-emerald-300 [&_td]:bg-emerald-100/80 hover:[&_td]:bg-emerald-100";
  }
  if (isReadyForDelivery(order)) {
    return "[&_td]:border-emerald-100 [&_td]:bg-emerald-50/70 hover:[&_td]:bg-emerald-50";
  }
  return "";
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
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(order.observations);
  const [savedValue, setSavedValue] = useState(order.observations);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnPointerDown(event: PointerEvent) {
      if (popoverRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!hasMeaningfulObservations(order.observations)) return null;
  function saveObservation() {
    const nextValue = value.trim();
    if (!nextValue) {
      setMessage("La observacion no puede quedar vacia.");
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await updateOrderObservation({ orderId: order.id, observations: nextValue });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setSavedValue(result.observations ?? nextValue);
      setValue(result.observations ?? nextValue);
      setEditing(false);
      setMessage("Guardado.");
    });
  }

  return (
    <div ref={popoverRef} className="group/comment relative shrink-0">
      <button
        type="button"
        aria-label={`Ver observacion de ${order.code}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="grid size-7 place-items-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 transition hover:border-amber-300 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 md:size-5"
      >
        <MessageSquare className="size-3.5 md:size-3" />
      </button>
      <div
        role="dialog"
        aria-label={`Observacion de ${order.code}`}
        className={cn(
          "absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-left text-sm font-medium leading-5 text-stone-800 shadow-lg shadow-stone-950/10 ring-1 ring-amber-100",
          open ? "block" : "hidden group-hover/comment:block group-focus-within/comment:block",
        )}
      >
        <span className="absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 border-l border-t border-amber-200 bg-white" />
        {editing ? (
          <div className="relative">
            <textarea
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="min-h-24 w-full resize-none rounded-md border border-amber-200 bg-white p-2 text-sm outline-none focus:border-amber-500"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={saveObservation}
                className="inline-flex h-8 items-center rounded-md bg-stone-950 px-2.5 text-xs font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
              >
                Guardar
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setValue(savedValue);
                  setEditing(false);
                  setMessage(null);
                }}
                className="inline-flex h-8 items-center rounded-md border border-stone-200 px-2.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <p className="relative max-h-32 overflow-y-auto whitespace-pre-line pr-1">{savedValue}</p>
        )}
        {message ? <p className="relative mt-2 text-xs font-semibold text-stone-600">{message}</p> : null}
        <div className="relative mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditing((current) => !current)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-amber-200 px-2.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-50"
          >
            <Pencil className="size-3.5" />
            Editar
          </button>
          <Link
            href={`/admin/orders/${order.id}#observaciones`}
            className="inline-flex h-8 items-center rounded-md border border-stone-200 px-2.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-50"
          >
            Abrir detalle
          </Link>
        </div>
      </div>
    </div>
  );
}
function buildCounters(orders: Order[], steps: SystemSettings["production"]["steps"], finishedCount: number) {
  const byStep = steps.map((step) => ({
    key: step.key,
    label: step.label,
    count: isDeliveredMetricStep(step) ? finishedCount : orders.filter((order) => metricStepKey(order) === step.key).length,
  }));
  return {
    lh: orders.filter((order) => order.store === "LH").length,
    lr: orders.filter((order) => order.store === "LR").length,
    late: orders.filter((order) => daysUntil(order.deliveryDate) < 0).length,
    today: orders.filter((order) => daysUntil(order.deliveryDate) === 0).length,
    week: orders.filter((order) => daysUntil(order.deliveryDate) >= 0 && daysUntil(order.deliveryDate) <= 7).length,
    sewing: orders.filter((order) => currentStep(order)?.key === "sewing" && currentStep(order)?.status === "active").length,
    activeWork: orders.filter((order) => currentStep(order)?.status === "active").length,
    byStep,
  };
}

function isDeliveredMetricStep(step: Pick<ProductionStep, "key" | "label">) {
  return /dispatch|despacho|terminado/i.test(`${step.key} ${step.label}`);
}

function metricStepKey(order: Order) {
  const current = currentStep(order);
  if (!current) return undefined;
  if (current.status === "active") return current.key;
  if (isWaitingForStep(order, current)) {
    const currentIndex = order.steps.findIndex((step) => step.key === current.key);
    return order.steps.slice(0, currentIndex).findLast((step) => step.status === "done")?.key ?? current.key;
  }
  return undefined;
}

function isDashboardHiddenStep(step: Pick<ProductionStep, "key" | "label">) {
  const normalized = `${step.key} ${step.label}`.toLowerCase();
  return normalized.includes("en_blanco") || normalized.includes("blanco") || normalized.includes("quality") || normalized.includes("calidad");
}

function isDashboardMetricHiddenStep(step: Pick<ProductionStep, "key" | "label">) {
  const normalized = `${step.key} ${step.label}`.toLowerCase();
  return normalized.includes("en_blanco") || normalized.includes("blanco") || normalized.includes("quality") || normalized.includes("calidad");
}

function matchesFilter(order: Order, filter: DashboardFilter) {
  if (filter === "active") return isDashboardActiveOrder(order);
  return true;
}

function isDashboardActiveOrder(order: Order) {
  if (["completed", "cancelled"].includes(order.status)) return false;
  return !isReadyForDelivery(order);
}

function isDashboardVisibleOrder(order: Order) {
  return isProductionOrder(order) && order.status !== "cancelled";
}

function matchesSearch(order: Order, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [order.code, order.client, order.product, order.material, order.color, order.groupCode]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(query));
}

function sortOrders(a: Order, b: Order, sortKey: SortKey, steps: SystemSettings["production"]["steps"]) {
  if (sortKey === "code") return a.code.localeCompare(b.code) || stableOrderTieBreaker(a, b);
  if (sortKey === "progress") return dashboardCompletionPercent(a, steps) - dashboardCompletionPercent(b, steps) || stableOrderTieBreaker(a, b);
  if (sortKey === "recent") {
    const entryDiff = dateTime(b.entryDate) - dateTime(a.entryDate);
    return entryDiff || b.code.localeCompare(a.code) || stableOrderTieBreaker(a, b);
  }
  return a.deliveryDate.localeCompare(b.deliveryDate) || stableOrderTieBreaker(a, b);
}

function stableOrderTieBreaker(a: Order, b: Order) {
  return a.store.localeCompare(b.store) || a.code.localeCompare(b.code) || compareOrderGroupMembers(a, b);
}

function dashboardCompletionPercent(order: Order, steps: SystemSettings["production"]["steps"]) {
  return steps.length ? completionPercent(order) : 0;
}

function dateTime(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function paginationLabel(total: number, currentPage: number) {
  if (!total) return "Mostrando 0 notas";
  const from = (currentPage - 1) * ORDERS_PER_PAGE + 1;
  const to = Math.min(currentPage * ORDERS_PER_PAGE, total);
  return `Mostrando ${from}-${to} de ${total} notas`;
}

function visiblePageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const start = Math.min(Math.max(currentPage - 2, 1), totalPages - 4);
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function statusPresentation(order: Order): { label: string; tone: Tone; icon: React.ElementType } {
  if (order.status === "completed") return { label: "Entregado", tone: "green", icon: Truck };
  if (order.status === "blocked" || order.steps.some((step) => step.status === "blocked")) return { label: "Bloqueada", tone: "rose", icon: CircleDashed };
  if (isReadyForDelivery(order)) return { label: "Terminado", tone: "green", icon: CheckCircle2 };
  if (order.steps.length && order.steps.every((step) => step.status === "pending")) return { label: "Sin empezar", tone: "stone", icon: Clock3 };
  const step = currentStep(order);
  if (!step) return { label: "Sin empezar", tone: "stone", icon: Clock3 };
  if (isWaitingForStep(order, step)) return { label: `En espera de ${cleanStepLabel(step.label)}`, tone: "blue", icon: Clock3 };
  return { label: currentStepStatusLabel(step), tone: stepTone(step), icon: stepIconByKey(step.key, step.label) };
}

function currentStep(order: Order) {
  return (
    order.steps.find((step) => step.status === "active") ??
    order.steps.find((step) => step.status === "blocked") ??
    order.steps.find((step) => step.status === "pending")
  );
}

function orderWithStage(order: Order, stepKey: AreaKey): Order {
  const targetIndex = order.steps.findIndex((step) => step.key === stepKey);
  if (targetIndex < 0) return order;
  const now = new Date().toISOString();
  const targetIsFinalStep = targetIndex === order.steps.length - 1 && isFinishedStep(order.steps[targetIndex]);
  return {
    ...order,
    steps: order.steps.map((step, index) => {
      if (index < targetIndex || (targetIsFinalStep && index === targetIndex)) return { ...step, status: "done", startedAt: step.startedAt ?? step.completedAt ?? now, completedAt: step.completedAt ?? now };
      if (index === targetIndex) return { ...step, status: "pending", startedAt: undefined, completedAt: undefined };
      return { ...step, status: "pending", startedAt: undefined, completedAt: undefined };
    }),
  };
}

function isFinishedStep(step: Pick<ProductionStep, "key" | "label">) {
  return /dispatch|despacho|terminado/i.test(`${step.key} ${step.label}`);
}

function orderWithStepStatuses(order: Order, statuses: Record<string, OptimisticStepStatus>): Order {
  const now = new Date().toISOString();
  const steps = order.steps.map((step) => {
    const optimisticStatus = statuses[optimisticStepStatusKey(order.id, step.key)];
    if (!optimisticStatus || step.status !== optimisticStatus.previousStatus) return step;
    const { status } = optimisticStatus;
    if (status === "pending") return { ...step, status, startedAt: undefined, completedAt: undefined };
    if (status === "active") return { ...step, status, startedAt: step.startedAt ?? now, completedAt: undefined };
    if (status === "done") return { ...step, status, startedAt: step.startedAt ?? now, completedAt: now };
    return { ...step, status };
  });
  const finalStep = steps.at(-1);
  const autoCompleteFinalStep =
    finalStep?.status === "pending" &&
    isFinishedStep(finalStep) &&
    steps.slice(0, -1).every((step) => step.status === "done");
  return {
    ...order,
    steps: autoCompleteFinalStep
      ? steps.map((step, index) => index === steps.length - 1
        ? { ...step, status: "done" as const, startedAt: step.startedAt ?? now, completedAt: now }
        : step)
      : steps,
  };
}

function optimisticStepStatusKey(orderId: string, stepKey: AreaKey) {
  return `${orderId}:${stepKey}`;
}

function removeOrderStepStatuses(statuses: Record<string, OptimisticStepStatus>, orderId: string) {
  return Object.fromEntries(
    Object.entries(statuses).filter(([key]) => !key.startsWith(`${orderId}:`)),
  ) as Record<string, OptimisticStepStatus>;
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

function isWaitingForStep(order: Order, step: ProductionStep) {
  if (step.status !== "pending") return false;
  const stepIndex = order.steps.findIndex((item) => item.key === step.key);
  if (stepIndex < 0) return false;
  return productionStepPrerequisitesMet(order.steps, stepIndex);
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
