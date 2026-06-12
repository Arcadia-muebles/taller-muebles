"use client";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  GripVertical,
  Maximize2,
  MessageSquareText,
  PackageOpen,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { moveOrderStage } from "@/app/admin/orders/actions";
import type { AreaKey, Order, ProductionStep, SystemSettings } from "@/lib/types";
import { cn, daysUntil, deliveryLabel, durationLabel, formatDate } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

type ProductionBoardProps = {
  orders: Order[];
  steps: SystemSettings["production"]["steps"];
  canMove: boolean;
};

type Feedback = {
  tone: "success" | "error";
  message: string;
};

export function ProductionBoard({ orders, steps, canMove }: ProductionBoardProps) {
  const enabledSteps = steps.filter((step) => step.enabled);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeStepTab, setActiveStepTab] = useState<AreaKey>(enabledSteps[0]?.key);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverStep, setHoverStep] = useState<AreaKey | null>(null);
  const [stageOverrides, setStageOverrides] = useState<Record<string, AreaKey>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [, startTransition] = useTransition();

  const boardOrders = useMemo(
    () =>
      orders.map((order) => {
        const override = stageOverrides[order.id];
        return override ? orderWithStage(order, override) : order;
      }),
    [orders, stageOverrides],
  );

  const grouped = useMemo(() => {
    const map = new Map<AreaKey, Order[]>();
    for (const step of enabledSteps) map.set(step.key, []);
    for (const order of boardOrders) {
      const current = currentStep(order);
      if (!current) continue;
      const list = map.get(current.key);
      if (list) list.push(order);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.deliveryDate ?? "9999-12-31").localeCompare(b.deliveryDate ?? "9999-12-31"));
    }
    return map;
  }, [boardOrders, enabledSteps]);

  const selected = boardOrders.find((order) => order.id === selectedId) ?? boardOrders[0];

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
    <section className="mt-5">
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
        </div>

        <div className="p-4">
          {/* Selector de etapas en móvil */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4 lg:hidden scrollbar-none snap-x -mx-4 px-4">
            {enabledSteps.map((step) => {
              const columnOrders = grouped.get(step.key) ?? [];
              const isActive = activeStepTab === step.key;
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setActiveStepTab(step.key)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition snap-center border select-none",
                    isActive
                      ? "bg-stone-950 border-stone-950 text-white shadow-sm"
                      : "bg-white border-stone-200 text-stone-600 hover:border-stone-300"
                  )}
                >
                  <span>{step.label}</span>
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-colors",
                    isActive ? "bg-white/20 text-white" : "bg-stone-100 text-stone-500"
                  )}>
                    {columnOrders.length}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
            <div className="flex flex-col lg:flex-row gap-4">
              {enabledSteps.map((step) => {
                const columnOrders = grouped.get(step.key) ?? [];
                const isHover = hoverStep === step.key;
                const isActiveTab = activeStepTab === step.key;
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
                      "flex flex-col rounded-lg border bg-stone-50 min-h-[400px] lg:min-h-[620px] transition-all",
                      isHover ? "border-stone-950 bg-white" : "border-stone-200",
                      "w-full lg:w-[270px] xl:w-72 shrink-0",
                      isActiveTab ? "flex" : "hidden lg:flex"
                    )}
                  >
                    <header className="border-b border-stone-200 px-3.5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate text-sm font-bold text-stone-950">{step.label}</h3>
                        <span className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-bold text-stone-600">
                          {columnOrders.length}
                        </span>
                      </div>
                    </header>
                    <div className="flex flex-1 flex-col gap-2.5 p-3 overflow-y-auto max-h-[500px] lg:max-h-none">
                      {columnOrders.map((order) => {
                        const current = currentStep(order);
                        return (
                          <ProductCard
                            key={order.id}
                            order={order}
                            step={current}
                            selected={selectedId === order.id}
                            dragging={draggingId === order.id}
                            draggable={canMove}
                            onSelect={() => setSelectedId(order.id)}
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
                        <div className="grid min-h-24 place-items-center rounded-md border border-dashed border-stone-200 bg-white p-3 text-center text-xs text-stone-400">
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
      </div>

      {selectedId && selected && (
        <OrderDetailDrawer order={selected} onClose={() => setSelectedId(null)} />
      )}
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
  const isActive = step?.status === "active";

  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={cn(
        "cursor-pointer rounded-lg border bg-white p-2.5 transition text-left select-none relative group",
        selected
          ? "border-stone-950 shadow-md ring-1 ring-stone-950"
          : "border-stone-200 hover:border-stone-400 hover:shadow-sm",
        dragging ? "opacity-40" : "",
        isBlocked ? "border-rose-200 bg-rose-50/50" : "",
      )}
    >
      {draggable && (
        <div className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="size-3.5 text-stone-400" />
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap pr-4">
        <span className="font-mono text-[10px] font-bold tracking-tight text-stone-500 uppercase bg-stone-100 px-1.5 py-0.5 rounded">
          {order.code}
        </span>
        {isBlocked && (
          <span className="inline-flex items-center gap-0.5 rounded bg-rose-100 px-1 py-0.5 text-[9px] font-bold text-rose-800">
            <AlertTriangle className="size-2.5" />
            Detenida
          </span>
        )}
        {isActive && (
          <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
            En proceso
          </span>
        )}
      </div>

      <div className="mt-2">
        <p className="text-xs font-semibold text-stone-900 truncate">{order.client}</p>
        <p className="text-[11px] text-stone-500 truncate mt-0.5">{order.product}</p>
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-stone-100 pt-2 text-[11px]">
        <span className="text-stone-400">Entrega</span>
        <span className={cn(
          "font-medium",
          isLate ? "text-rose-600 font-semibold" : isToday ? "text-amber-700 font-semibold" : "text-stone-600"
        )}>
          {isLate || isToday ? deliveryLabel(order.deliveryDate, false) : formatDate(order.deliveryDate)}
        </span>
      </div>
    </article>
  );
}

function OrderDetailDrawer({ order, onClose }: { order: Order; onClose: () => void }) {
  const step = currentStep(order);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-950/40 backdrop-blur-xs animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <aside className="relative w-full sm:w-[460px] bg-stone-50 h-full shadow-2xl border-l border-stone-200 flex flex-col z-10 animate-slide-in-right">
        {/* Header */}
        <div className="bg-white border-b border-stone-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="page-kicker">Detalle de orden</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-stone-950 truncate">{order.code}</h2>
              <p className="mt-0.5 text-sm font-medium text-stone-600 truncate">{order.product}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Link
                href={`/admin/orders/${order.id}`}
                className="btn btn-secondary size-9 p-0 animate-none"
                title="Ver ficha completa"
              >
                <Maximize2 className="size-4" />
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary size-9 p-0"
                aria-label="Cerrar detalle"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge type="order" value={order.status} />
            {step ? <StatusBadge type="step" value={step.status} /> : null}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <DetailBlock icon={UserRound} label="Cliente" value={order.client} />

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailBlock icon={PackageOpen} label="Material" value={`${order.material} / ${order.color}`} />
            <DetailBlock icon={CalendarDays} label="Entrega" value={formatDate(order.deliveryDate)} />
          </div>

          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-stone-500">
              <Clock className="size-3.5" />
              Etapa actual
            </div>
            <p className="mt-2 text-sm font-semibold text-stone-950">
              {step ? `${step.label} · ${step.owner || "Sin asignar"}` : "Sin etapa activa"}
            </p>
            {step?.startedAt && (
              <p className="mt-1 text-xs text-stone-500">
                Iniciada el {formatDate(step.startedAt)}
              </p>
            )}
          </div>

          <section className="rounded-lg border border-stone-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-stone-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Tiempos por etapa</h3>
            </div>
            <div className="mt-3 space-y-2">
              {order.steps.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3 text-xs border-b border-stone-50 pb-1.5 last:border-0 last:pb-0">
                  <span className="truncate text-stone-600 font-medium">{item.label}</span>
                  <span className="shrink-0 font-mono text-stone-950 bg-stone-50 px-1.5 py-0.5 rounded text-[10px]">
                    {durationLabel(item.startedAt, item.completedAt)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {order.observations && (
            <section className="rounded-lg border border-stone-200 bg-white p-3">
              <div className="flex items-center gap-2">
                <MessageSquareText className="size-4 text-stone-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Observaciones</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-stone-600 whitespace-pre-wrap">{order.observations}</p>
            </section>
          )}
        </div>

        {/* Footer actions */}
        <div className="bg-white border-t border-stone-200 p-4 mt-auto">
          <Link href={`/admin/orders/${order.id}`} className="btn btn-primary w-full">
            Ver ficha completa
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </aside>
    </div>
  );}

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
