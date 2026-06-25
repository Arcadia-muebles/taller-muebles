"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  GripVertical,
  MessageSquareText,
  MessageSquareWarning,
  PackageOpen,
  PauseCircle,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { closeOrder, moveOrderStage } from "@/app/admin/orders/actions";
import { updateProductionStep } from "@/app/taller/actions";
import type { AreaKey, Order, ProductionStep, SystemSettings } from "@/lib/types";
import { cn, daysUntil, deliveryLabel, durationLabel, formatDate, hasMeaningfulObservations } from "@/lib/utils";
import { ConfirmSubmitButton } from "./confirm-submit-button";
import { OrderLabelPrintButton } from "./order-label-print-button";
import { StatusBadge } from "./status-badge";

type ProductionBoardProps = {
  orders: Order[];
  allOrders?: Order[];
  steps: SystemSettings["production"]["steps"];
  canMove: boolean;
};

type Feedback = {
  tone: "success" | "error";
  message: string;
};

export function ProductionBoard({ orders, allOrders = orders, steps, canMove }: ProductionBoardProps) {
  const enabledSteps = useMemo(() => steps.filter((step) => step.enabled), [steps]);
  const [selectedId, setSelectedId] = useState<string | null>(orders[0]?.id ?? null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverStep, setHoverStep] = useState<AreaKey | null>(null);
  const [groupFilter, setGroupFilter] = useState("all");
  const [stageOverrides, setStageOverrides] = useState<Record<string, AreaKey>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [, startTransition] = useTransition();

  const boardOrders = useMemo(
    () =>
      orders.map((order) => {
        const configuredOrder = orderWithConfiguredSteps(order, enabledSteps);
        const override = stageOverrides[order.id];
        return override ? orderWithStage(configuredOrder, override) : configuredOrder;
      }),
    [enabledSteps, orders, stageOverrides],
  );
  const groupOptions = useMemo(
    () => Array.from(new Set(boardOrders.map((order) => order.groupCode).filter(Boolean))).sort(),
    [boardOrders],
  );
  const visibleBoardOrders = useMemo(
    () => boardOrders.filter((order) => groupFilter === "all" || order.groupCode === groupFilter),
    [boardOrders, groupFilter],
  );

  const grouped = useMemo(() => {
    const map = new Map<AreaKey, Order[]>();
    for (const step of enabledSteps) map.set(step.key, []);
    for (const order of visibleBoardOrders) {
      const current = currentStep(order);
      if (!current) continue;
      const list = map.get(current.key);
      if (list) list.push(order);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
    }
    return map;
  }, [enabledSteps, visibleBoardOrders]);

  const selected = visibleBoardOrders.find((order) => order.id === selectedId) ?? visibleBoardOrders[0];

  function move(orderId: string, stepKey: AreaKey) {
    const order = boardOrders.find((item) => item.id === orderId);
    const current = order ? currentStep(order) : undefined;
    if (!order || current?.key === stepKey || !canMove) return;

    setStageOverrides((currentOverrides) => ({ ...currentOverrides, [orderId]: stepKey }));
    setFeedback(null);
    startTransition(async () => {
      const result = await moveOrderStage({ orderId, stepKey });
      if (!result.ok) {
        setStageOverrides((currentOverrides) => {
          const next = { ...currentOverrides };
          delete next[orderId];
          return next;
        });
        setFeedback({ tone: "error", message: result.message });
        return;
      }
      setFeedback({ tone: "success", message: "Orden movida." });
    });
  }

  return (
    <section className={cn(
      "mt-5 grid min-w-0 gap-5",
      detailOpen ? "2xl:grid-cols-[minmax(0,1fr)_390px]" : "grid-cols-1",
    )}>
      <div className="panel min-w-0 overflow-hidden">
        <div className="panel-header flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="panel-title">Tablero productivo</h2>
            <p className="panel-description">
              {canMove
                ? "Arrastra una tarjeta para moverla entre etapas."
                : "Vista de seguimiento por etapa productiva."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {feedback ? (
              <div className={cn(
                "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm font-medium",
                feedback.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800",
              )}>
                <span>{feedback.message}</span>
                <button type="button" onClick={() => setFeedback(null)} aria-label="Ocultar mensaje" className="grid size-6 place-items-center rounded hover:bg-white/60">
                  <X className="size-3.5" />
                </button>
              </div>
            ) : null}
            <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className="control h-8 min-w-0 bg-white py-1 text-xs text-stone-700">
              <option value="all">Todos los pedidos</option>
              {groupOptions.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
            {!detailOpen ? (
              <button type="button" onClick={() => setDetailOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-950">
                <ChevronLeft className="size-4" />
                Mostrar detalle
              </button>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto p-4">
          <div
            className="grid w-full gap-3"
            style={{ gridTemplateColumns: `repeat(${enabledSteps.length}, minmax(168px, 1fr))` }}
          >
            {enabledSteps.map((step) => {
              const columnOrders = grouped.get(step.key) ?? [];
              const isHover = hoverStep === step.key;
              return (
                <section
                  key={step.key}
                  onDragOver={(event) => {
                    if (!canMove) return;
                    event.preventDefault();
                    setHoverStep(step.key);
                  }}
                  onDragLeave={() => setHoverStep(null)}
                  onDrop={(event) => {
                    event.preventDefault();
                    const orderId = event.dataTransfer.getData("text/plain");
                    setHoverStep(null);
                    setDraggingId(null);
                    if (orderId) move(orderId, step.key);
                  }}
                  className={cn(
                    "flex min-h-[620px] flex-col rounded-lg border bg-stone-50",
                    isHover ? "border-stone-950 bg-white" : "border-stone-200",
                  )}
                >
                  <header className="border-b border-stone-200 px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-sm font-semibold text-stone-950">{step.label}</h3>
                      <span className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-xs font-medium text-stone-600">
                        {columnOrders.length}
                      </span>
                    </div>
                  </header>
                  <div className="flex flex-1 flex-col gap-3 p-3">
                    {columnOrders.map((order) => {
                      const current = currentStep(order);
                      return (
                        <ProductCard
                          key={order.id}
                          order={order}
                          step={current}
                          selected={selected?.id === order.id}
                          dragging={draggingId === order.id}
                          draggable={canMove}
                          onSelect={() => {
                            setSelectedId(order.id);
                            setDetailOpen(true);
                          }}
                          onDragStart={(event) => {
                            if (!canMove) return;
                            setDraggingId(order.id);
                            event.dataTransfer.setData("text/plain", order.id);
                            event.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setHoverStep(null);
                          }}
                        />
                      );
                    })}
                    {!columnOrders.length ? (
                      <div className="grid min-h-28 place-items-center rounded-md border border-dashed border-stone-200 bg-white p-3 text-center text-xs text-stone-400">
                        Sin productos en esta etapa.
                      </div>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>

      {detailOpen ? (
        <OrderDetailDrawer
          order={selected}
          groupOrders={allOrders.filter((item) => item.status !== "cancelled" && item.groupCode === selected?.groupCode)}
          canMove={canMove}
          onClose={() => setDetailOpen(false)}
        />
      ) : null}
    </section>
  );
}

function ProductCard({
  order,
  step,
  selected,
  dragging,
  draggable,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  order: Order;
  step?: ProductionStep;
  selected: boolean;
  dragging: boolean;
  draggable: boolean;
  onSelect: () => void;
  onDragStart: React.DragEventHandler<HTMLElement>;
  onDragEnd: React.DragEventHandler<HTMLElement>;
}) {
  const days = daysUntil(order.deliveryDate);
  const isLate = days < 0;
  const isToday = days === 0;
  const isBlocked = step?.status === "blocked" || order.status === "blocked";

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={cn(
        "min-w-0 cursor-pointer overflow-hidden rounded-lg border bg-white p-3 text-left transition",
        selected ? "border-stone-950 shadow-sm" : "border-stone-200 hover:border-stone-400",
        dragging ? "opacity-50" : "",
        isBlocked ? "border-rose-200 bg-rose-50" : "",
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs font-semibold text-stone-500" title={order.code}>{order.code}</p>
          <h4 className="mt-2 line-clamp-2 text-sm font-semibold text-stone-950">{order.product}</h4>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {hasMeaningfulObservations(order.observations) ? (
            <MessageSquareWarning className="size-4 text-amber-600" aria-label="Tiene observaciones" />
          ) : null}
          {draggable ? <GripVertical className="size-4 text-stone-300" /> : null}
        </div>
      </div>
      <p className="mt-2 truncate text-xs font-medium text-stone-700">{order.client}</p>
      <p className="mt-1 truncate font-mono text-[11px] font-semibold text-stone-500">Pedido {order.groupCode}</p>
      <p className="mt-1 line-clamp-2 text-xs text-stone-500">{order.material} / {order.color}</p>

      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
        {step ? <StatusBadge type="step" value={step.status} className="h-6 max-w-full px-2 text-[11px]" /> : null}
        {isLate || isToday ? (
          <span className={cn(
            "inline-flex h-6 max-w-full min-w-0 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold",
            isLate ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-800",
          )}>
            <AlertTriangle className="size-3 shrink-0" />
            <span className="truncate">{deliveryLabel(order.deliveryDate, false)}</span>
          </span>
        ) : null}
      </div>

      <div className="mt-3 border-t border-stone-100 pt-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">Entrega</p>
        <p className="mt-1 text-xs font-semibold text-stone-900">{formatDate(order.deliveryDate)}</p>
      </div>
    </button>
  );
}

function OrderDetailDrawer({
  order,
  groupOrders,
  canMove,
  onClose,
}: {
  order?: Order;
  groupOrders: Order[];
  canMove: boolean;
  onClose: () => void;
}) {
  if (!order) {
    return (
      <aside className="panel-pad hidden self-start 2xl:block">
        <p className="text-sm text-stone-500">Selecciona una tarjeta para ver sus datos.</p>
        <button type="button" onClick={onClose} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-950">
          <ChevronRight className="size-4" />
          Ocultar detalle
        </button>
      </aside>
    );
  }

  const step = currentStep(order);

  return (
    <aside className="panel self-start overflow-hidden 2xl:sticky 2xl:top-5">
      <div className="border-b border-stone-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="page-kicker">Detalle</p>
            <h2 className="mt-2 text-xl font-semibold text-stone-950">{order.code}</h2>
            <p className="mt-1 text-sm text-stone-500">{order.product}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-stone-950" aria-label="Ocultar panel de detalle" title="Ocultar panel de detalle">
              <ChevronRight className="size-4" />
            </button>
            <Link href={`/admin/orders/${order.id}`} className="grid size-8 place-items-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-stone-950" aria-label="Abrir detalle completo" title="Abrir detalle completo">
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {order.status !== "blocked" || step?.status !== "blocked" ? (
            <StatusBadge type="order" value={order.status} />
          ) : null}
          {step?.status === "blocked" && canMove ? (
            <UnblockStepButton orderId={order.id} stepKey={step.key} />
          ) : step ? (
            <StatusBadge type="step" value={step.status} />
          ) : null}
        </div>
      </div>

      <div className="space-y-4 p-4">
        <OrderLabelPrintButton order={order} groupOrders={groupOrders} className="w-full justify-center" />
        <DetailBlock icon={UserRound} label="Cliente" value={order.client} />
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
          <DetailBlock icon={PackageOpen} label="Material" value={`${order.material} / ${order.color}`} />
          <DetailBlock icon={CalendarDays} label="Entrega" value={`${formatDate(order.deliveryDate)} · ${deliveryLabel(order.deliveryDate, false)}`} />
        </div>
        <DetailBlock icon={Clock} label="Etapa actual" value={step ? `${step.label} · ${step.owner}` : "Sin etapa activa"} />

        <section className="rounded-lg border border-stone-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-stone-500" />
            <h3 className="text-sm font-semibold text-stone-950">Tiempos por etapa</h3>
          </div>
          <div className="mt-3 space-y-2">
            {order.steps.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-stone-600">{item.label}</span>
                <span className="shrink-0 font-medium text-stone-950">{durationLabel(item.startedAt, item.completedAt)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <MessageSquareText className="size-4 text-stone-500" />
            <h3 className="text-sm font-semibold text-stone-950">Observaciones</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-stone-600">{order.observations}</p>
        </section>

        {step?.key === "dispatch" ? (
          <form action={closeOrder}>
            <input type="hidden" name="orderId" value={order.id} />
            <ConfirmSubmitButton
              title="Confirmar entrega"
              description="La orden saldrá del tablero activo y quedará registrada como entregada en el historial."
              confirmLabel="Confirmar entrega"
              pendingLabel="Entregando..."
              tone="neutral"
              triggerClassName="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-50"
              trigger={<><Truck className="size-4" />Entregar</>}
            />
          </form>
        ) : null}

        <Link href={`/admin/orders/${order.id}`} className="btn btn-primary w-full">
          Ver todos los datos
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </aside>
  );
}

function UnblockStepButton({ orderId, stepKey }: { orderId: string; stepKey: AreaKey }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function unblock() {
    setError(null);
    startTransition(async () => {
      const result = await updateProductionStep({ orderId, stepKey, status: "pending" });
      if (result.status === "error") setError(result.message);
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={unblock}
        title="Quitar el bloqueo de esta etapa"
        className="inline-flex h-7 items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
      >
        <PauseCircle className="size-3.5" />
        {pending ? "Desbloqueando..." : "Desbloquear"}
      </button>
      {error ? <p className="mt-1 text-xs font-medium text-rose-700">{error}</p> : null}
    </div>
  );
}

function DetailBlock({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-stone-500">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-stone-950">{value}</p>
    </div>
  );
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
  return {
    ...order,
    steps: order.steps.map((step, index) => {
      if (index < targetIndex) return { ...step, status: "done" };
      if (index === targetIndex) return { ...step, status: "pending", startedAt: undefined, completedAt: undefined };
      return { ...step, status: "pending" };
    }),
  };
}

function orderWithConfiguredSteps(
  order: Order,
  enabledSteps: SystemSettings["production"]["steps"],
): Order {
  if (!enabledSteps.length) return order;

  const existingByKey = new Map(order.steps.map((step) => [step.key, step]));
  const configuredKeys = new Set(enabledSteps.map((step) => step.key));
  const current = currentStep(order);
  const currentConfiguredIndex = current ? enabledSteps.findIndex((step) => step.key === current.key) : -1;
  const completed = order.status === "completed" || order.steps.every((step) => step.status === "done");

  const configuredSteps: ProductionStep[] = enabledSteps.map((stepConfig, index) => {
    const existing = existingByKey.get(stepConfig.key);
    if (existing) {
      return {
        ...existing,
        label: existing.label || stepConfig.label,
      };
    }

    return {
      key: stepConfig.key,
      label: stepConfig.label,
      owner: stepConfig.label,
      status: completed || (currentConfiguredIndex >= 0 && index < currentConfiguredIndex) ? "done" : "pending",
    };
  });

  return {
    ...order,
    steps: [
      ...configuredSteps,
      ...order.steps.filter((step) => !configuredKeys.has(step.key)),
    ],
  };
}
