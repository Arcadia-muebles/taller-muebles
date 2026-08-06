"use client";

import {
  Armchair,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  CircleDashed,
  Clock3,
  Printer,
  Scissors,
  Search,
  ShieldCheck,
  Sofa,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { moveOrderStage } from "@/app/admin/orders/actions";
import { updateStructureStage } from "@/app/admin/structures/actions";
import { updateProductionStep } from "@/app/taller/actions";
import { OrderLabelPrintButton } from "@/components/order-label-print-button";
import { OrderNotesDialog } from "@/components/order-notes-dialog";
import { completionPercent, isReadyForDelivery } from "@/lib/metrics";
import { compareOrderGroupMembers, isIndependentStartStep, isProductionOrder, orderGroupPositions, productionOrderGroup, productionStepPrerequisitesMet } from "@/lib/orders";
import type { AreaKey, Order, OrderAttachment, OrderComment, ProductionStep, StepStatus, StructureRequest, SystemSettings } from "@/lib/types";
import { cn, daysUntil, deliveryLabel, formatDate } from "@/lib/utils";

type ActiveProductionDashboardProps = {
  orders: Order[];
  steps: SystemSettings["production"]["steps"];
  canMove: boolean;
  canComment: boolean;
  commentsByOrder?: Record<string, OrderComment[]>;
  attachmentsByOrder?: Record<string, OrderAttachment[]>;
  structureRequests?: StructureRequest[];
  finishedCount?: number;
};

type DashboardFilter = "all" | "active";
type SortKey = "recent" | "delivery" | "code" | "progress";
type Tone = "green" | "blue" | "amber" | "purple" | "rose" | "stone";
type DashboardColumnKey = "code" | "product" | "color" | "process" | "status" | "delivery" | "progress";
type OptimisticStepStatus = { status: StepStatus; previousStatus: StepStatus };
type StructureStage = "unrequested" | "requested" | "in_progress" | "done";

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
  { key: "product", label: "Cantidad / producto", width: 190, min: 150, max: 420 },
  { key: "color", label: "Color", width: 75, min: 65, max: 170 },
  { key: "process", label: "Procesos", width: 250, min: 220, max: 500, align: "center" },
  { key: "status", label: "Estado actual", width: 120, min: 110, max: 260 },
  { key: "delivery", label: "Entrega", width: 100, min: 90, max: 190 },
  { key: "progress", label: "Avance", width: 70, min: 65, max: 130 },
];

const defaultColumnWidths = Object.fromEntries(dashboardColumns.map((column) => [column.key, column.width])) as Record<DashboardColumnKey, number>;

export function ActiveProductionDashboard({ orders, steps, canMove, canComment, commentsByOrder = {}, attachmentsByOrder = {}, structureRequests = [], finishedCount = 0 }: ActiveProductionDashboardProps) {
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
  const [isPrintingAllOrders, setIsPrintingAllOrders] = useState(false);
  const [optimisticStage, setOptimisticStage] = useState<Record<string, AreaKey>>({});
  const [optimisticStepStatuses, setOptimisticStepStatuses] = useState<Record<string, OptimisticStepStatus>>({});
  const [optimisticStructureStages, setOptimisticStructureStages] = useState<Record<string, StructureStage>>({});
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
  const renderedOrders = isPrintingAllOrders ? displayedOrders : paginatedOrders;
  const pageNumbers = useMemo(() => visiblePageNumbers(currentPage, totalPages), [currentPage, totalPages]);

  useEffect(() => {
    if (!isPrintingAllOrders) return;

    document.body.classList.add("printing-production-list");
    const printFrame = window.requestAnimationFrame(() => {
      try {
        window.print();
      } finally {
        document.body.classList.remove("printing-production-list");
        setIsPrintingAllOrders(false);
      }
    });

    return () => {
      window.cancelAnimationFrame(printFrame);
      document.body.classList.remove("printing-production-list");
    };
  }, [isPrintingAllOrders]);

  const counters = useMemo(() => buildCounters(activeOrders, enabledSteps.filter((step) => !isDashboardMetricHiddenStep(step)), finishedCount), [activeOrders, enabledSteps, finishedCount]);
  const structureRequestStatusByOrder = useMemo(
    () => new Map(structureRequests.filter((request) => request.status !== "cancelled").map((request) => [request.orderId, request.status])),
    [structureRequests],
  );
  const dashboardProcessCount = dashboardSteps.length;
  const tableWidth = useMemo(() => dashboardColumns.reduce((total, column) => total + columnWidths[column.key], 0), [columnWidths]);

  function move(order: Order, stepKey: AreaKey) {
    const current = currentStep(order);
    const target = order.steps.find((step) => step.key === stepKey);
    const statusKey = optimisticStepStatusKey(order.id, stepKey);
    if (!canMove || order.status === "completed" || order.status === "cancelled") return;
    if (pendingStepStatuses[statusKey]) return;
    if (stepKey === "structure" && target) {
      moveStructure(order, target);
      return;
    }

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

  function moveStructure(order: Order, step: ProductionStep) {
    const currentStage = optimisticStructureStages[order.id]
      ?? structureStageFor(order, structureRequestStatusByOrder.get(order.id));
    const nextStage = currentStage === "unrequested"
      ? "requested"
      : currentStage === "requested"
        ? "in_progress"
        : currentStage === "in_progress"
          ? "done"
          : "in_progress";
    persistStructureStage(order, step, nextStage);
  }

  function persistStructureStage(order: Order, step: ProductionStep, nextStage: StructureStage) {
    const statusKey = optimisticStepStatusKey(order.id, step.key);
    const nextStepStatus: StepStatus = nextStage === "done" ? "done" : nextStage === "in_progress" ? "active" : "pending";
    const persistedStatus = dashboardOrders
      .find((candidate) => candidate.id === order.id)
      ?.steps.find((candidate) => candidate.key === "structure")
      ?.status ?? step.status;

    setFeedback(null);
    setOptimisticStructureStages((current) => ({ ...current, [order.id]: nextStage }));
    setOptimisticStepStatuses((current) => ({
      ...current,
      [statusKey]: { status: nextStepStatus, previousStatus: persistedStatus },
    }));
    setPendingStepStatuses((current) => ({ ...current, [statusKey]: true }));

    startTransition(async () => {
      try {
        const result = await updateStructureStage({
          orderId: order.id,
          status: nextStage === "unrequested" ? "draft" : nextStage,
        });
        if (result.ok) {
          setFeedback({ tone: "success", message: result.message });
          return;
        }
        setOptimisticStructureStages((current) => removeRecordKey(current, order.id));
        setOptimisticStepStatuses((current) => removeRecordKey(current, statusKey));
        setFeedback({ tone: "error", message: result.message });
      } catch {
        setOptimisticStructureStages((current) => removeRecordKey(current, order.id));
        setOptimisticStepStatuses((current) => removeRecordKey(current, statusKey));
        setFeedback({ tone: "error", message: "No fue posible actualizar la estructura. Intenta nuevamente." });
      } finally {
        setPendingStepStatuses((current) => removeRecordKey(current, statusKey));
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
    <section className="production-list-print-root mt-5 space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[repeat(6,minmax(0,1fr))]">
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

      <section className="production-list-print-area panel overflow-hidden print:overflow-visible">
        <div className="production-list-print-controls border-b border-stone-200 p-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="-mx-1 flex min-w-0 flex-nowrap gap-1.5 overflow-x-auto px-1 pb-1">
              <FilterChip active={filter === "all"} label="Todos" count={dashboardOrders.length} onClick={() => updateFilter("all")} />
              <FilterChip active={filter === "active"} label="Activos" count={activeOrders.length} onClick={() => updateFilter("active")} />
              <button
                type="button"
                onClick={() => setIsPrintingAllOrders(true)}
                disabled={isPrintingAllOrders}
                className="inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950"
              >
                <Printer className="size-3.5" />
                {isPrintingAllOrders ? "Preparando..." : "Imprimir lista"}
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

        <div className="production-list-table-scroll overflow-x-auto bg-stone-50/70 p-1.5">
          <table className="production-list-table w-full table-fixed border-separate border-spacing-y-1" style={{ minWidth: tableWidth }}>
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
                  <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(dashboardProcessCount, 1)}, minmax(30px, 1fr))` }}>
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
              {renderedOrders.map((order) => {
                const structureStage = optimisticStructureStages[order.id]
                  ?? structureStageFor(order, structureRequestStatusByOrder.get(order.id));
                const presentation = statusPresentation(order, structureStage);
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
                            <OrderNotesDialog
                              order={order}
                              comments={commentsByOrder[order.id] ?? []}
                              attachments={attachmentsByOrder[order.id] ?? []}
                              canComment={canComment}
                            />
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
                      <p className="whitespace-normal break-words text-xs font-semibold uppercase leading-5 text-stone-950">
                        <span className="mr-1.5 font-mono text-stone-500">{formatOrderQuantity(order.quantity)}</span>
                        {order.product}
                      </p>
                    </BodyCell>
                    <BodyCell>
                      <p title={order.color || "Sin color"} className="line-clamp-2 break-words text-xs font-semibold leading-4 text-stone-900">
                        {order.color || "Sin color"}
                      </p>
                    </BodyCell>
                    <BodyCell className="text-center">
                      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(dashboardProcessCount, 1)}, minmax(30px, 1fr))` }}>
                        {dashboardSteps.map((step) => {
                          const orderStep = order.steps.find((item) => item.key === step.key);
                          const resolvedStep = orderStep ?? { key: step.key, label: step.label, owner: step.label, status: "pending" as const };
                          return (
                            <StepDot
                              key={step.key}
                              order={order}
                              step={resolvedStep}
                              structureStage={step.key === "structure" ? structureStage : undefined}
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

        <div className="production-list-print-controls flex flex-col gap-3 border-t border-stone-200 px-4 py-3 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
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
  structureStage,
  canMove,
  pending,
  onMove,
}: {
  order: Order;
  step: ProductionStep;
  structureStage?: StructureStage;
  canMove: boolean;
  pending: boolean;
  onMove: () => void;
}) {
  const disabled = pending || !canMove || order.status === "completed" || order.status === "cancelled";
  const waiting = isWaitingForStep(order, step);
  const directAction = structureStage
    ? structureStage === "unrequested"
      ? `Marcar ${step.label} como Pedida`
      : structureStage === "requested"
        ? `Marcar ${step.label} como En estructura`
        : structureStage === "in_progress"
          ? `Marcar ${step.label} como Lista`
          : `Reabrir ${step.label} como En estructura`
    : step.status === "active"
      ? `Marcar ${step.label} como listo`
      : isIndependentStartStep(step.key)
        ? step.status === "done"
          ? `Reabrir ${step.label}`
          : `Iniciar ${step.label}`
        : undefined;
  const Icon = structureStage === "requested" || step.status === "done"
    ? Check
    : step.status === "active"
      ? Circle
      : step.status === "blocked"
        ? X
        : Circle;
  return (
    <button
      type="button"
      data-order-id={order.id}
      data-step-key={step.key}
      data-step-status={step.status}
      disabled={disabled}
      onClick={onMove}
      title={directAction ?? (waiting ? `${step.label}: disponible para iniciar` : disabled ? step.label : `Mover a ${step.label}`)}
      aria-label={directAction ? `${directAction} para ${order.code}` : disabled ? `${step.label}: ${step.status}` : `Mover ${order.code} a ${step.label}`}
      data-structure-status={structureStage}
      className={cn(
        "production-process-indicator mx-auto grid size-6 place-items-center rounded-md border transition",
        structureStage ? structureProductionStageClass(structureStage) : stepDotClass(step.status, stepTone(step)),
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
  const stopped = order.status === "completed" || order.condition === "Entregado";
  const stoppedAt = order.completedAt ?? latestCompletedStepDate(order);
  const days = stopped ? (stoppedAt ? daysUntil(order.deliveryDate, stoppedAt) : 0) : daysUntil(order.deliveryDate);
  const late = days < 0;
  const label = stopped
    ? late ? `Vencido ${Math.abs(days)}d` : "Listo"
    : deliveryLabel(order.deliveryDate, false);
  return (
    <div className="min-w-0">
      <p className="inline-flex items-center gap-1 text-xs font-semibold text-stone-900">
        <CalendarDays className="size-3.5 text-stone-400" />
        {formatDate(order.deliveryDate)}
      </p>
      <p className={cn("mt-1 text-xs font-semibold", late ? "text-rose-700" : stopped ? "text-emerald-700" : days <= 7 ? "text-amber-700" : "text-emerald-700")}>
        {label}
      </p>
    </div>
  );
}

function latestCompletedStepDate(order: Order) {
  return order.steps
    .flatMap((step) => step.completedAt ? [step.completedAt] : [])
    .filter((value) => Number.isFinite(new Date(value).getTime()))
    .sort((left, right) => right.localeCompare(left))[0];
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
  return isProductionOrder(order) && !isDeliveredOrder(order) && order.status !== "cancelled";
}

function matchesSearch(order: Order, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [order.code, order.client, order.product, order.material, order.color, order.groupCode]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(query));
}

function sortOrders(a: Order, b: Order, sortKey: SortKey, steps: SystemSettings["production"]["steps"]) {
  const deliveredDiff = Number(isDeliveredOrder(a)) - Number(isDeliveredOrder(b));
  if (deliveredDiff) return deliveredDiff;
  if (sortKey === "code") return a.code.localeCompare(b.code) || stableOrderTieBreaker(a, b);
  if (sortKey === "progress") return dashboardCompletionPercent(a, steps) - dashboardCompletionPercent(b, steps) || stableOrderTieBreaker(a, b);
  if (sortKey === "recent") {
    const entryDiff = dateTime(b.entryDate) - dateTime(a.entryDate);
    return entryDiff || b.code.localeCompare(a.code) || stableOrderTieBreaker(a, b);
  }
  return a.deliveryDate.localeCompare(b.deliveryDate) || stableOrderTieBreaker(a, b);
}

function isDeliveredOrder(order: Order) {
  return order.status === "completed" || order.condition === "Entregado";
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

function formatOrderQuantity(quantity?: number) {
  const value = quantity ?? 1;
  if (Number.isInteger(value)) return String(value).padStart(2, "0");
  return new Intl.NumberFormat("es-CL", { minimumIntegerDigits: 2, maximumFractionDigits: 2 }).format(value);
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

function statusPresentation(order: Order, structureStage?: StructureStage): { label: string; tone: Tone; icon: React.ElementType } {
  if (order.status === "completed") return { label: "Terminado", tone: "green", icon: Truck };
  if (order.status === "blocked" || order.steps.some((step) => step.status === "blocked")) return { label: "Bloqueada", tone: "rose", icon: CircleDashed };
  if (isReadyForDelivery(order)) return { label: "Terminado", tone: "green", icon: CheckCircle2 };
  const current = currentDashboardStep(order);
  if (current?.key === "structure" && structureStage === "unrequested") {
    return { label: "Sin empezar", tone: "stone", icon: Clock3 };
  }
  if (current?.key === "structure" && structureStage === "requested") {
    return { label: "Estructura pedida", tone: "green", icon: CheckCircle2 };
  }
  if (current?.key === "structure" && structureStage === "in_progress") {
    return { label: "En estructura", tone: "amber", icon: Sofa };
  }
  const dashboardSteps = order.steps.filter((step) => !isDashboardHiddenStep(step));
  if (dashboardSteps.length && dashboardSteps.every((step) => step.status === "pending")) return { label: "Sin empezar", tone: "stone", icon: Clock3 };
  const step = current;
  if (!step) return { label: "Sin empezar", tone: "stone", icon: Clock3 };
  if (step.status === "done") {
    return { label: completedStepStatusLabel(step), tone: stepTone(step), icon: CheckCircle2 };
  }
  if (step.status === "pending") return { label: waitingStepStatusLabel(step), tone: "blue", icon: Clock3 };
  return { label: currentStepStatusLabel(step), tone: stepTone(step), icon: stepIconByKey(step.key, step.label) };
}

function currentStep(order: Order) {
  return (
    order.steps.find((step) => step.status === "active") ??
    order.steps.find((step) => step.status === "blocked") ??
    order.steps.find((step) => step.status === "pending")
  );
}

function currentDashboardStep(order: Order) {
  const steps = order.steps.filter((step) => !isDashboardHiddenStep(step));
  return (
    steps.find((step) => step.status === "active") ??
    steps.find((step) => step.status === "blocked") ??
    steps.find((step) => step.status === "pending") ??
    steps.findLast((step) => step.status === "done")
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

function structureStageFor(order: Order, requestStatus?: StructureRequest["status"]): StructureStage {
  const step = order.steps.find((item) => item.key === "structure");
  if (step?.status === "done" || requestStatus === "done") return "done";
  if (step?.status === "active" || requestStatus === "in_progress") return "in_progress";
  if (requestStatus === "requested") return "requested";
  return "unrequested";
}

function structureProductionStageClass(stage: StructureStage) {
  const classes: Record<StructureStage, string> = {
    unrequested: "border-stone-300 bg-white text-stone-400",
    requested: "border-emerald-300 bg-emerald-50 text-emerald-700",
    in_progress: "border-blue-300 bg-blue-50 text-blue-700",
    done: "border-emerald-300 bg-emerald-50 text-emerald-700",
  };
  return classes[stage];
}

function removeRecordKey<T>(record: Record<string, T>, key: string) {
  const next = { ...record };
  delete next[key];
  return next;
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
  if (/structure|estructura/i.test(normalized)) return "En estructura";
  if (/cutting|corte/i.test(normalized)) return "En corte";
  if (/sewing|costura/i.test(normalized)) return "En costura";
  if (/upholstery|tapicer/i.test(normalized)) return "En tapicería";
  return `En ${cleanStepLabel(step.label)}`;
}

function waitingStepStatusLabel(step: Pick<ProductionStep, "key" | "label">) {
  const normalized = `${step.key} ${step.label}`;
  if (/cutting|corte/i.test(normalized)) return "En espera de Corte";
  if (/sewing|costura/i.test(normalized)) return "En espera de costura";
  if (/upholstery|tapicer/i.test(normalized)) return "En espera de tapicería";
  if (/dispatch|despacho|terminado/i.test(normalized)) return "Terminado";
  return "Sin empezar";
}

function completedStepStatusLabel(step: Pick<ProductionStep, "key" | "label">) {
  const normalized = `${step.key} ${step.label}`;
  if (/structure|estructura/i.test(normalized)) return "Estructura lista";
  if (/cutting|corte/i.test(normalized)) return "Corte Listo";
  if (/sewing|costura/i.test(normalized)) return "Costura lista";
  return "Terminado";
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
