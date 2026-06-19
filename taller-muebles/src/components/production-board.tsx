"use client";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  GripVertical,
  Maximize2,
  MessageSquarePlus,
  MessageSquareText,
  PackageOpen,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { addOrderComment, type CollaborationActionResult } from "@/app/admin/orders/collaboration-actions";
import { moveOrderStage } from "@/app/admin/orders/actions";
import type { AreaKey, Order, OrderComment, ProductionStep, SystemSettings } from "@/lib/types";
import { cn, daysUntil, deliveryLabel, formatDate, totalDurationLabel } from "@/lib/utils";
import { SubmitButton } from "./submit-button";
import { StatusBadge } from "./status-badge";

type ProductionBoardProps = {
  orders: Order[];
  steps: SystemSettings["production"]["steps"];
  canMove: boolean;
  commentsByOrder?: Record<string, OrderComment[]>;
};

type Feedback = {
  tone: "success" | "error";
  message: string;
};

type TouchDrag = {
  orderId: string;
  startX: number;
  startY: number;
  moved: boolean;
};

const initialCommentState: CollaborationActionResult = { ok: false, message: "" };

export function ProductionBoard({ orders, steps, canMove, commentsByOrder = {} }: ProductionBoardProps) {
  const enabledSteps = steps.filter((step) => step.enabled);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeStepTab, setActiveStepTab] = useState<AreaKey>(enabledSteps[0]?.key);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverStep, setHoverStep] = useState<AreaKey | null>(null);
  const [, setTouchDrag] = useState<TouchDrag | null>(null);
  const [stageOverrides, setStageOverrides] = useState<Record<string, AreaKey>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const touchDragRef = useRef<TouchDrag | null>(null);
  const suppressSelectRef = useRef<string | null>(null);
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

    setActiveStepTab(stepKey);
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

  function stepFromPoint(clientX: number, clientY: number) {
    const element = document.elementFromPoint(clientX, clientY);
    const target = element?.closest<HTMLElement>("[data-mobile-step-drop]");
    return target?.dataset.mobileStepDrop ?? null;
  }

  function onMobilePointerDown(event: React.PointerEvent<HTMLElement>, orderId: string) {
    if (!canMove || event.pointerType === "mouse") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextDrag = {
      orderId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    touchDragRef.current = nextDrag;
    setTouchDrag(nextDrag);
    setDraggingId(orderId);
    setFeedback(null);
  }

  function onMobilePointerMove(event: React.PointerEvent<HTMLElement>, orderId: string) {
    const currentDrag = touchDragRef.current;
    if (!currentDrag || currentDrag.orderId !== orderId) return;

    const moved = currentDrag.moved || Math.abs(event.clientX - currentDrag.startX) + Math.abs(event.clientY - currentDrag.startY) > 10;
    const nextHover = stepFromPoint(event.clientX, event.clientY);
    setHoverStep(nextHover);
    if (moved) event.preventDefault();
    if (moved !== currentDrag.moved) {
      const nextDrag = { ...currentDrag, moved };
      touchDragRef.current = nextDrag;
      setTouchDrag(nextDrag);
    }
  }

  function onMobilePointerUp(event: React.PointerEvent<HTMLElement>, orderId: string) {
    const currentDrag = touchDragRef.current;
    if (!currentDrag || currentDrag.orderId !== orderId) return;

    const targetStep = stepFromPoint(event.clientX, event.clientY) ?? hoverStep;
    finishMobileDrop(orderId, targetStep, currentDrag.moved);
  }

  function finishMobileDrop(orderId: string, targetStep: AreaKey | null, moved: boolean) {
    touchDragRef.current = null;
    setTouchDrag(null);
    setDraggingId(null);
    setHoverStep(null);

    if (!moved) return;
    suppressSelectRef.current = orderId;
    if (targetStep) move(orderId, targetStep);
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
          {canMove ? (
            <p className="mb-2 text-xs font-medium text-stone-500 lg:hidden">
              {draggingId ? "Suelta la tarjeta dentro de la pila destino." : "En movil, arrastra una tarjeta hacia la pila de otra etapa."}
            </p>
          ) : null}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4 lg:hidden scrollbar-none snap-x -mx-4 px-4">
            {enabledSteps.map((step) => {
              const columnOrders = grouped.get(step.key) ?? [];
              const isActive = activeStepTab === step.key;
              return (
                <button
                  key={step.key}
                  type="button"
                  data-mobile-step-drop={step.key}
                  onClick={() => setActiveStepTab(step.key)}
                  onPointerUp={(event) => {
                    const currentDrag = touchDragRef.current;
                    if (!currentDrag?.moved) return;
                    event.preventDefault();
                    finishMobileDrop(currentDrag.orderId, step.key, true);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition snap-center border select-none",
                    hoverStep === step.key
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                      : isActive
                      ? "bg-stone-950 border-stone-950 text-white shadow-sm"
                      : "bg-white border-stone-200 text-stone-600 hover:border-stone-300"
                  )}
                >
                  <span>{step.label}</span>
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-colors",
                    hoverStep === step.key || isActive ? "bg-white/20 text-white" : "bg-stone-100 text-stone-500"
                  )}>
                    {columnOrders.length}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
            <div
              className="flex flex-col gap-4 lg:grid"
              style={{ gridTemplateColumns: `repeat(${Math.max(enabledSteps.length, 1)}, minmax(0, 1fr))` }}
            >
              {enabledSteps.map((step) => {
                const columnOrders = grouped.get(step.key) ?? [];
                const isHover = hoverStep === step.key;
                return (
                  <section
                    key={step.key}
                    data-mobile-step-drop={step.key}
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
                      "min-w-0 flex flex-col rounded-lg border bg-stone-50 min-h-[220px] lg:min-h-[620px] transition-all",
                      isHover ? "border-stone-950 bg-white" : "border-stone-200",
                      "w-full",
                      "flex"
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
                            commentsCount={commentsByOrder[order.id]?.length ?? 0}
                            onSelect={() => {
                              if (suppressSelectRef.current === order.id) {
                                suppressSelectRef.current = null;
                                return;
                              }
                              setSelectedId(order.id);
                            }}
                            onComment={() => setSelectedId(order.id)}
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
                            onPointerDown={(event) => onMobilePointerDown(event, order.id)}
                            onPointerMove={(event) => onMobilePointerMove(event, order.id)}
                            onPointerUp={(event) => onMobilePointerUp(event, order.id)}
                            onPointerCancel={() => {
                              touchDragRef.current = null;
                              setTouchDrag(null);
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
        <OrderDetailDrawer order={selected} comments={commentsByOrder[selected.id] ?? []} onClose={() => setSelectedId(null)} />
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
  commentsCount,
  onSelect,
  onComment,
  onDragStart,
  onDragEnd,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  order: Order;
  step?: ProductionStep;
  selected: boolean;
  dragging: boolean;
  draggable: boolean;
  commentsCount: number;
  onSelect: () => void;
  onComment: () => void;
  onDragStart: React.DragEventHandler<HTMLElement>;
  onDragEnd: React.DragEventHandler<HTMLElement>;
  onPointerDown: React.PointerEventHandler<HTMLElement>;
  onPointerMove: React.PointerEventHandler<HTMLElement>;
  onPointerUp: React.PointerEventHandler<HTMLElement>;
  onPointerCancel: React.PointerEventHandler<HTMLElement>;
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
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className={cn(
        "cursor-pointer touch-none rounded-lg border bg-white p-2.5 transition text-left select-none relative group",
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
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-medium",
            isLate ? "text-rose-600 font-semibold" : isToday ? "text-amber-700 font-semibold" : "text-stone-600"
          )}>
            {isLate || isToday ? deliveryLabel(order.deliveryDate, false) : formatDate(order.deliveryDate)}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onComment();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            className="inline-flex h-6 items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-1.5 text-[10px] font-semibold text-stone-600 transition hover:border-stone-300 hover:bg-white hover:text-stone-950"
            aria-label={`Comentar ${order.code}`}
            title="Comentar"
          >
            <MessageSquarePlus className="size-3" />
            {commentsCount ? commentsCount : null}
          </button>
        </div>
      </div>
    </article>
  );
}

function OrderDetailDrawer({ order, comments, onClose }: { order: Order; comments: OrderComment[]; onClose: () => void }) {
  const step = currentStep(order);
  const commentFormRef = useRef<HTMLFormElement>(null);
  const [commentState, commentAction] = useActionState(
    async (_state: CollaborationActionResult, formData: FormData) => {
      const result = await addOrderComment(formData);
      if (result.ok) commentFormRef.current?.reset();
      return result;
    },
    initialCommentState,
  );

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
                    {totalDurationLabel(item)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <MessageSquarePlus className="size-4 text-stone-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Comentarios por etapa</h3>
            </div>
            <form ref={commentFormRef} action={commentAction} className="mt-3 space-y-2">
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="stepKey" value={step?.key ?? ""} />
              <textarea
                name="body"
                required
                minLength={2}
                maxLength={1000}
                placeholder={step ? `Comentario para ${step.label}...` : "Comentario sobre el producto..."}
                className="min-h-20 w-full resize-none rounded-md border border-stone-200 bg-stone-50 p-2.5 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CommentFeedback state={commentState} />
                <SubmitButton pendingLabel="Guardando..." className="inline-flex h-9 items-center justify-center rounded-md bg-stone-950 px-3 text-sm font-medium text-white disabled:opacity-50">
                  Guardar comentario
                </SubmitButton>
              </div>
            </form>
            <div className="mt-3 max-h-52 divide-y divide-stone-100 overflow-y-auto rounded-md border border-stone-100">
              {comments.map((comment) => (
                <article key={comment.id} className="p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-900">{comment.author}</p>
                      <p className="mt-0.5 text-xs text-stone-500">{comment.stepLabel ?? "Comentario general"}</p>
                    </div>
                    <time className="text-[10px] font-medium uppercase tracking-[0.1em] text-stone-400">
                      {new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(new Date(comment.createdAt))}
                    </time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-stone-600">{comment.body}</p>
                </article>
              ))}
              {!comments.length ? (
                <p className="p-3 text-xs text-stone-500">No hay comentarios para este producto.</p>
              ) : null}
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

function CommentFeedback({ state }: { state: CollaborationActionResult }) {
  if (!state.message) return <span className="text-xs text-stone-400">Se guarda con usuario, fecha y etapa.</span>;
  return (
    <span className={cn("text-xs font-medium", state.ok ? "text-emerald-700" : "text-rose-700")}>
      {state.message}
    </span>
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
      if (index === targetIndex) return { ...step, status: "active", completedAt: undefined };
      return { ...step, status: "pending" };
    }),
  };
}
