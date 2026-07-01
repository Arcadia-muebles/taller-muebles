"use client";

import {
  Archive,
  Armchair,
  Ban,
  CalendarDays,
  Check,
  Circle,
  Eye,
  PackageCheck,
  Palette,
  Play,
  RotateCcw,
  Scissors,
  Search,
  Shirt,
  SlidersHorizontal,
  Tag,
  Undo2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { updateProductionStep } from "@/app/taller/actions";
import type { AreaKey, Order, ProductionStep, Role, StepStatus } from "@/lib/types";
import { cn, deliveryLabel, formatDate, formatDateTime } from "@/lib/utils";
import {
  filterWorkerFutureOrders,
  filterWorkerHistoryOrders,
  filterWorkerOrders,
  nextWorkStep,
  workerActionStep,
  workerAreas,
} from "@/lib/workshop-access";
import { OrderLabelPrintButton } from "./order-label-print-button";

type WorkerQueueProps = {
  orders: Order[];
  user: {
    name: string;
    role: Role;
    area?: AreaKey;
    areas?: AreaKey[];
  };
  permissions: {
    canStart: boolean;
    canComplete: boolean;
    canBlock: boolean;
    requireBlockReason: boolean;
  };
  areaLabels?: Record<string, string>;
};

type WorkFilter = "all" | "pending" | "active" | "done" | "blocked";

export function WorkerQueue({ orders, user, permissions, areaLabels = {} }: WorkerQueueProps) {
  const [overrides, setOverrides] = useState<Record<string, StepStatus>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pendingTarget, setPendingTarget] = useState<{ orderId: string; status: StepStatus } | null>(null);
  const [filter, setFilter] = useState<WorkFilter>("all");
  const [planningQuery, setPlanningQuery] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const [planningLimit, setPlanningLimit] = useState(8);
  const [historyLimit, setHistoryLimit] = useState(8);
  const [pendingAction, startTransition] = useTransition();

  const workingOrders = useMemo(
    () =>
      orders.map((order) => ({
        ...order,
        steps: order.steps.map((step) => {
          const status = overrides[`${order.id}:${step.key}`] ?? step.status;
          return {
            ...step,
            status,
            startedAt: status === "pending" ? undefined : step.startedAt,
            completedAt: status === "done" ? step.completedAt ?? new Date().toISOString() : undefined,
          };
        }),
      })),
    [orders, overrides],
  );

  const visible = useMemo(() => filterWorkerOrders(user, workingOrders), [user, workingOrders]);
  const filteredVisible = useMemo(() => {
    if (filter === "all") return visible;
    return visible.filter((order) => workerActionStep(user, order)?.status === filter);
  }, [filter, user, visible]);
  const future = useMemo(() => filterWorkerFutureOrders(user, workingOrders), [user, workingOrders]);
  const history = useMemo(() => sortByWorkerCompletedAt(filterWorkerHistoryOrders(user, workingOrders), user), [user, workingOrders]);
  const filteredFuture = useMemo(() => filterOrders(future, planningQuery), [future, planningQuery]);
  const filteredHistory = useMemo(() => filterOrders(history, historyQuery), [history, historyQuery]);
  const areas = workerAreas(user);
  const areaName = areas
    .map((area) => areaLabels[area] ?? visible[0]?.steps.find((step) => step.key === area)?.label ?? area)
    .join(", ") || "Sin etapa";
  const areaIcon = iconForArea(areas[0]);

  function updateStep(order: Order, step: ProductionStep, status: StepStatus) {
    const comment = comments[order.id]?.trim();
    if (status === "blocked" && permissions.requireBlockReason && (!comment || comment.length < 5)) {
      setFeedback({ tone: "error", text: `${order.code}: escribe un motivo de bloqueo de al menos 5 caracteres.` });
      return;
    }
    setPendingTarget({ orderId: order.id, status });
    startTransition(async () => {
      const result = await updateProductionStep({
        orderId: order.id,
        stepKey: step.key,
        status,
        reason: comment || undefined,
      });

      if (result.status === "success") {
        setOverrides((current) => ({
          ...current,
          [`${order.id}:${step.key}`]: status,
        }));
        setComments((current) => ({ ...current, [order.id]: "" }));
        setFeedback({ tone: "success", text: `${order.code}: ${step.label} actualizado.` });
        setPendingTarget(null);
        return;
      }

      setFeedback({ tone: "error", text: `${order.code}: ${result.message}` });
      setPendingTarget(null);
    });
  }

  return (
    <section className="mx-auto max-w-6xl pb-20 lg:pb-0">
      <header className="flex flex-col gap-4 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-14 shrink-0 place-items-center rounded-lg border border-stone-200 bg-white shadow-sm shadow-stone-950/5">
            {areaIcon}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Lista de trabajos asignados</p>
            <h1 className="mt-1 truncate text-2xl font-semibold uppercase text-stone-950 sm:text-3xl">{areaName}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1 sm:w-40 sm:flex-none">
            <span className="sr-only">Filtrar trabajos</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as WorkFilter)}
              className="h-12 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-800 shadow-sm shadow-stone-950/5 outline-none"
            >
              <option value="all">Todos</option>
              <option value="pending">Por iniciar</option>
              <option value="active">En proceso</option>
              <option value="done">Terminados</option>
              <option value="blocked">Bloqueados</option>
            </select>
          </label>
          <div className="grid size-12 shrink-0 place-items-center rounded-lg border border-stone-200 bg-white text-stone-700 shadow-sm shadow-stone-950/5">
            <SlidersHorizontal className="size-5" />
          </div>
        </div>
      </header>

      {feedback ? (
        <div role="status" className={cn(
          "mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm font-medium",
          feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800",
        )}>
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} aria-label="Ocultar mensaje" className="grid size-8 place-items-center rounded-md hover:bg-white/60">
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {filteredVisible.map((order) => {
          const step = workerActionStep(user, order);
          if (!step) return null;
          return (
            <WorkCard
              key={order.id}
              order={order}
              step={step}
              comment={comments[order.id] ?? ""}
              setComment={(value) => setComments((current) => ({ ...current, [order.id]: value }))}
              permissions={permissions}
              pendingAction={pendingAction}
              pendingTarget={pendingTarget}
              updateStep={updateStep}
              groupOrders={groupOrders(workingOrders, order)}
            />
          );
        })}
        {!filteredVisible.length ? (
          <div className="empty-state text-left xl:col-span-2">
            {areas.length
              ? "No hay trabajos activos para tu etapa con este filtro."
              : "Tu usuario no tiene una etapa asignada. Pide al administrador que configure tu perfil."}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <details className="rounded-lg border border-stone-200 bg-white">
          <summary className="cursor-pointer list-none p-4">
            <QueueListHeader title="Planificacion" description="Trabajos que vienen despues." count={`${filteredFuture.length} por venir`} />
          </summary>
          <div className="border-t border-stone-200 p-4">
            <SearchField value={planningQuery} onChange={setPlanningQuery} placeholder="Buscar codigo, cliente o producto" />
            <div className="mt-3 grid gap-2">
              {filteredFuture.slice(0, planningLimit).map((order) => {
                const futureStep = workerFutureStep(user, order);
                const current = nextWorkStep(order);
                return (
                  <Link key={order.id} href={`/taller/orders/${order.id}`} className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-3 transition hover:border-stone-300 hover:bg-white">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-semibold">{order.code}</p>
                      <p className="mt-1 truncate text-sm font-medium text-stone-800">{order.product}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium uppercase text-stone-500">Ahora: {current?.label ?? "Sin etapa"}</p>
                      <p className="mt-1 text-sm font-semibold text-stone-900">Luego: {futureStep?.label ?? "Mi etapa"}</p>
                    </div>
                  </Link>
                );
              })}
              {!filteredFuture.length ? <p className="rounded-md border border-dashed border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">No hay productos pendientes en etapas previas.</p> : null}
            </div>
            {filteredFuture.length > planningLimit ? (
              <button type="button" onClick={() => setPlanningLimit((value) => value + 8)} className="btn btn-secondary mt-3 h-10 w-full">
                Ver mas
              </button>
            ) : null}
          </div>
        </details>

        <details className="rounded-lg border border-stone-200 bg-white">
          <summary className="cursor-pointer list-none p-4">
            <QueueListHeader title="Historial" description="Trabajos terminados por tu etapa." count={`${filteredHistory.length} registros`} />
          </summary>
          <div className="border-t border-stone-200 p-4">
            <SearchField value={historyQuery} onChange={setHistoryQuery} placeholder="Buscar historial" />
            <div className="mt-3 grid gap-2">
              {filteredHistory.slice(0, historyLimit).map((order) => {
                const step = latestWorkerDoneStep(user, order);
                return (
                  <Link key={order.id} href={`/taller/orders/${order.id}`} className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-stone-200 bg-white px-3 py-3 transition hover:border-stone-300 hover:bg-stone-50">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <Archive className="size-4 shrink-0 text-stone-400" />
                        <p className="truncate font-mono text-sm font-semibold">{order.code}</p>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-stone-800">{order.product}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium uppercase text-stone-500">{step?.label ?? "Proceso"}</p>
                      <p className="mt-1 text-sm font-semibold text-stone-900">{formatDateTime(step?.completedAt)}</p>
                    </div>
                  </Link>
                );
              })}
              {!filteredHistory.length ? <p className="rounded-md border border-dashed border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">Todavia no hay productos terminados por tu proceso.</p> : null}
            </div>
            {filteredHistory.length > historyLimit ? (
              <button type="button" onClick={() => setHistoryLimit((value) => value + 8)} className="btn btn-secondary mt-3 h-10 w-full">
                Ver mas
              </button>
            ) : null}
          </div>
        </details>
      </div>
    </section>
  );
}

function WorkCard({
  order,
  step,
  comment,
  setComment,
  permissions,
  pendingAction,
  pendingTarget,
  updateStep,
  groupOrders,
}: {
  order: Order;
  step: ProductionStep;
  comment: string;
  setComment: (value: string) => void;
  permissions: WorkerQueueProps["permissions"];
  pendingAction: boolean;
  pendingTarget: { orderId: string; status: StepStatus } | null;
  updateStep: (order: Order, step: ProductionStep, status: StepStatus) => void;
  groupOrders: Order[];
}) {
  const canStart = permissions.canStart && (step.status === "pending" || step.status === "blocked");
  const canFinish = permissions.canComplete && step.status === "active";
  const canBlock = permissions.canBlock && (step.status === "pending" || step.status === "active");
  const canUndoStart = permissions.canStart && step.status === "active";
  const canUndoFinish = permissions.canComplete && step.status === "done";
  const canUndoBlock = permissions.canBlock && step.status === "blocked";
  const isPendingForOrder = pendingAction && pendingTarget?.orderId === order.id;
  const delivery = deliveryLabel(order.deliveryDate, step.status === "done");

  return (
    <article className={cn("overflow-hidden rounded-xl border bg-white shadow-sm shadow-stone-950/5", cardTone(step, delivery))}>
      <div className="grid grid-cols-[minmax(0,1fr)_144px] divide-x divide-stone-100 max-[430px]:grid-cols-1 max-[430px]:divide-x-0">
        <div className="min-w-0 p-4">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <Link href={`/taller/orders/${order.id}`} className="truncate font-mono text-2xl font-bold text-stone-950 underline-offset-4 hover:underline">
                  {order.code}
                </Link>
                <span className="grid size-8 shrink-0 place-items-center rounded-md border border-stone-200 bg-white text-stone-500">
                  <Tag className="size-4" />
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-stone-500">{order.store === "LR" ? "La Reina" : "Leather House"}</p>
              <p className="mt-0.5 truncate text-sm font-semibold uppercase text-stone-700">{order.client}</p>
            </div>
          </div>

          <div className="mt-4 border-t border-stone-100 pt-4">
            <div className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-3">
              <div className="grid size-11 place-items-center rounded-lg bg-stone-50 text-stone-800">
                <Armchair className="size-6" />
              </div>
              <div className="min-w-0">
                <h2 className="break-words text-base font-bold uppercase leading-snug text-stone-950">{order.product}</h2>
                <div className="mt-3 flex min-w-0 items-center gap-2 text-sm text-stone-600">
                  <Palette className="size-4 shrink-0" />
                  <span className="shrink-0 font-semibold uppercase">Color:</span>
                  <span className="truncate uppercase">{order.color || "Por definir"}</span>
                </div>
                <p className="mt-1 truncate text-sm text-stone-500">{order.material}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid min-h-full grid-rows-[1fr_auto] gap-3 p-3 max-[430px]:border-t max-[430px]:border-stone-100">
          <div className="grid grid-cols-1 gap-3 max-[430px]:grid-cols-2">
            <div className="rounded-lg border border-stone-100 bg-stone-50 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-stone-600">
                <CalendarDays className="size-3.5" />
                Entrega
              </p>
              <p className="mt-2 font-mono text-base font-semibold text-stone-950">{formatDate(order.deliveryDate)}</p>
              <p className={cn("mt-1 text-xs font-bold", delivery.startsWith("Vencido") || delivery === "Hoy" ? "text-rose-600" : "text-stone-500")}>{delivery}</p>
            </div>
            <StatusPanel status={step.status} />
          </div>

          <div className="grid gap-2">
            {canStart ? (
              <button type="button" onClick={() => updateStep(order, step, "active")} disabled={pendingAction} className="work-action work-action-primary">
                <Play className="size-5 fill-current" />
                {isPendingForOrder && pendingTarget?.status === "active" ? "Iniciando" : "Iniciar trabajo"}
              </button>
            ) : null}
            {canFinish ? (
              <button type="button" onClick={() => updateStep(order, step, "done")} disabled={pendingAction} className="work-action border-blue-300 bg-white text-blue-700 hover:bg-blue-50">
                <Check className="size-5" />
                {isPendingForOrder && pendingTarget?.status === "done" ? "Terminando" : "Terminar trabajo"}
              </button>
            ) : null}
            {step.status === "done" ? (
              <Link href={`/taller/orders/${order.id}`} className="work-action border-stone-200 bg-white text-stone-800 hover:bg-stone-50">
                <Eye className="size-5" />
                Ver detalle
              </Link>
            ) : null}
            {!canStart && !canFinish && step.status !== "done" ? (
              <Link href={`/taller/orders/${order.id}`} className="work-action border-stone-200 bg-white text-stone-800 hover:bg-stone-50">
                <Eye className="size-5" />
                Ver detalle
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <details className="border-t border-stone-100 bg-stone-50/70">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-stone-700">
          Mas acciones
        </summary>
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="block">
            <span className="text-xs font-semibold uppercase text-stone-500">{permissions.requireBlockReason ? "Motivo si bloqueas" : "Nota opcional"}</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={500}
              placeholder="Ej. falta material para continuar"
              className="textarea-control mt-2 min-h-16 bg-white"
            />
          </label>
          <div className="grid gap-2 sm:min-w-44">
            {canBlock ? (
              <button type="button" onClick={() => updateStep(order, step, "blocked")} disabled={pendingAction} className="btn h-10 border border-rose-200 bg-white text-rose-700 hover:bg-rose-50">
                <Ban className="size-4" />
                {isPendingForOrder && pendingTarget?.status === "blocked" ? "Bloqueando" : "Bloquear"}
              </button>
            ) : null}
            {canUndoStart ? (
              <button type="button" onClick={() => updateStep(order, step, "pending")} disabled={pendingAction} className="btn btn-secondary h-10">
                <Undo2 className="size-4" />
                Deshacer inicio
              </button>
            ) : null}
            {canUndoFinish ? (
              <button type="button" onClick={() => updateStep(order, step, "active")} disabled={pendingAction} className="btn h-10 border border-amber-200 bg-white text-amber-800 hover:bg-amber-50">
                <RotateCcw className="size-4" />
                Reabrir
              </button>
            ) : null}
            {canUndoBlock ? (
              <button type="button" onClick={() => updateStep(order, step, "pending")} disabled={pendingAction} className="btn btn-secondary h-10">
                <Undo2 className="size-4" />
                Quitar bloqueo
              </button>
            ) : null}
            <OrderLabelPrintButton order={order} groupOrders={groupOrders} className="h-10 justify-center" />
          </div>
        </div>
      </details>
    </article>
  );
}

function StatusPanel({ status }: { status: StepStatus }) {
  const styles: Record<StepStatus, { label: string; icon: React.ReactNode; className: string }> = {
    pending: {
      label: "Por iniciar",
      icon: <Circle className="size-5" />,
      className: "border-stone-200 bg-white text-stone-700",
    },
    active: {
      label: "En confeccion",
      icon: <PackageCheck className="size-5" />,
      className: "border-blue-100 bg-blue-50 text-blue-700",
    },
    done: {
      label: "Terminado",
      icon: <Check className="size-5" />,
      className: "border-emerald-100 bg-emerald-50 text-emerald-700",
    },
    blocked: {
      label: "Bloqueado",
      icon: <Ban className="size-5" />,
      className: "border-rose-100 bg-rose-50 text-rose-700",
    },
  };
  const item = styles[status];
  return (
    <div className={cn("flex items-center justify-center gap-2 rounded-lg border p-3 text-center text-xs font-bold uppercase", item.className)}>
      {item.icon}
      <span>{item.label}</span>
    </div>
  );
}

function QueueListHeader({ title, description, count }: { title: string; description: string; count: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-stone-950">{title}</h3>
        <p className="truncate text-sm text-stone-500">{description}</p>
      </div>
      <span className="inline-flex h-8 shrink-0 items-center rounded-full border border-stone-200 bg-white px-3 text-xs font-medium text-stone-600">
        {count}
      </span>
    </div>
  );
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="flex h-10 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-600">
      <Search className="size-4 shrink-0 text-stone-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
      />
    </label>
  );
}

function cardTone(step: ProductionStep, delivery: string) {
  if (step.status === "blocked" || delivery.startsWith("Vencido")) return "border-rose-200";
  if (step.status === "active") return "border-blue-200";
  if (step.status === "done") return "border-emerald-200";
  return "border-stone-200";
}

function iconForArea(area?: AreaKey) {
  if (area === "cutting") return <Scissors className="size-7 text-stone-950" />;
  if (area === "sewing") return <Shirt className="size-7 text-stone-950" />;
  if (area === "upholstery") return <Armchair className="size-7 text-stone-950" />;
  return <PackageCheck className="size-7 text-stone-950" />;
}

function groupOrders(orders: Order[], order: Order) {
  return orders.filter((item) => item.status !== "cancelled" && item.groupCode === order.groupCode);
}

function filterOrders(orders: Order[], query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return orders;
  return orders.filter((order) => (
    [
      order.code,
      order.groupCode,
      order.client,
      order.product,
      order.material,
      order.color,
    ].join(" ").toLocaleLowerCase().includes(normalized)
  ));
}

function workerFutureStep(user: WorkerQueueProps["user"], order: Order) {
  const areas = workerAreas(user);
  return order.steps.find((step) => areas.includes(step.key) && step.status === "pending");
}

function latestWorkerDoneStep(user: WorkerQueueProps["user"], order: Order) {
  const areas = workerAreas(user);
  return [...order.steps]
    .reverse()
    .find((step) => areas.includes(step.key) && step.status === "done");
}

function sortByWorkerCompletedAt(orders: Order[], user: WorkerQueueProps["user"]) {
  return [...orders].sort((left, right) => {
    const leftTime = completedTime(latestWorkerDoneStep(user, left)?.completedAt);
    const rightTime = completedTime(latestWorkerDoneStep(user, right)?.completedAt);
    return rightTime - leftTime;
  });
}

function completedTime(value?: string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}
