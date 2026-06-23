"use client";

import { Ban, Check, ChevronRight, MessageSquare, Play, RotateCcw, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { updateProductionStep } from "@/app/taller/actions";
import type { AreaKey, Order, ProductionStep, Role, StepStatus } from "@/lib/types";
import { deliveryLabel, formatDate, formatDateTime } from "@/lib/utils";
import { filterWorkerFutureOrders, filterWorkerOrders, workerActionStep, workerAreas } from "@/lib/workshop-access";
import { OrderLabelPrintButton } from "./order-label-print-button";
import { StatusBadge } from "./status-badge";

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

export function WorkerQueue({ orders, user, permissions, areaLabels = {} }: WorkerQueueProps) {
  const [overrides, setOverrides] = useState<Record<string, StepStatus>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pendingTarget, setPendingTarget] = useState<{ orderId: string; status: StepStatus } | null>(null);
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
            completedAt: status === "done"
              ? step.completedAt ?? new Date().toISOString()
              : undefined,
          };
        }),
      })),
    [orders, overrides],
  );

  const visible = useMemo(() => filterWorkerOrders(user, workingOrders), [user, workingOrders]);
  const future = useMemo(() => filterWorkerFutureOrders(user, workingOrders), [user, workingOrders]);
  const areaName = workerAreas(user)
    .map((area) => areaLabels[area] ?? visible[0]?.steps.find((step) => step.key === area)?.label ?? area)
    .join(", ") || "Sin etapa";

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
    <section className="panel">
      <div className="panel-header">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="panel-title">Mis trabajos</h2>
            <p className="panel-description">Etapa asignada: {areaName}</p>
          </div>
          <span className="inline-flex h-8 items-center rounded-full border border-stone-200 bg-white px-3 text-xs font-medium text-stone-600">
            {visible.length} trabajos
          </span>
        </div>
        {feedback ? (
          <div role="status" className={`mt-4 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm font-medium ${feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
            <span>{feedback.text}</span>
            <button type="button" onClick={() => setFeedback(null)} aria-label="Ocultar mensaje" className="grid size-7 place-items-center rounded-md hover:bg-white/60">
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="hidden overflow-x-auto p-4 md:block">
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Codigo</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Cliente / producto</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Material</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Etapa</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Entrega</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Comentario</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((order) => {
              const step = workerActionStep(user, order);
              if (!step) return null;
              const canStart = permissions.canStart && (step.status === "pending" || step.status === "blocked");
              const canFinish = permissions.canComplete && step.status === "active";
              const canBlock = permissions.canBlock && (step.status === "pending" || step.status === "active");
              const canUndoStart = permissions.canStart && step.status === "active";
              const canUndoFinish = permissions.canComplete && step.status === "done";
              const canUndoBlock = permissions.canBlock && step.status === "blocked";
              const isPendingForOrder = pendingAction && pendingTarget?.orderId === order.id;
              return (
                <tr key={order.id} className={`border-b border-stone-100 last:border-0 ${rowTone(order, step)}`}>
                  <td className="px-3 py-3 align-top">
                    <Link href={`/taller/orders/${order.id}`} className="font-mono text-sm font-semibold underline-offset-4 hover:underline">
                      {order.code}
                    </Link>
                    <p className="mt-1 font-mono text-xs text-stone-500">{order.groupCode}</p>
                  </td>
                  <td className="max-w-[260px] px-3 py-3 align-top">
                    <p className="truncate text-sm font-semibold text-stone-950">{order.client}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-stone-700">{order.product}</p>
                  </td>
                  <td className="max-w-[180px] px-3 py-3 align-top text-sm text-stone-600">
                    <p className="truncate">{order.material}</p>
                    <p className="mt-1 truncate text-xs text-stone-500">{order.color}</p>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <StatusBadge type="step" value={step.status} />
                    <p className="mt-2 text-xs font-medium text-stone-600">{step.label}</p>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <p className="text-sm font-semibold text-stone-900">{formatDate(order.deliveryDate)}</p>
                    <p className="mt-1 text-xs font-semibold text-rose-600">{deliveryLabel(order.deliveryDate, false)}</p>
                  </td>
                  <td className="w-[220px] px-3 py-3 align-top">
                    <textarea
                      value={comments[order.id] ?? ""}
                      onChange={(event) => setComments((current) => ({ ...current, [order.id]: event.target.value }))}
                      maxLength={500}
                      placeholder="Motivo o nota"
                      className="textarea-control min-h-16 bg-white text-sm"
                    />
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-wrap gap-2">
                      {canStart ? (
                        <button type="button" onClick={() => updateStep(order, step, "active")} disabled={pendingAction} className="btn h-9 bg-stone-950 text-white hover:bg-stone-800">
                          <Play className="size-4" />
                          {isPendingForOrder && pendingTarget?.status === "active" ? "..." : "Empezar"}
                        </button>
                      ) : null}
                      {canFinish ? (
                        <button type="button" onClick={() => updateStep(order, step, "done")} disabled={pendingAction} className="btn h-9 border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100">
                          <Check className="size-4" />
                          {isPendingForOrder && pendingTarget?.status === "done" ? "..." : "Terminar"}
                        </button>
                      ) : null}
                      {canBlock ? (
                        <button type="button" onClick={() => updateStep(order, step, "blocked")} disabled={pendingAction} className="btn h-9 border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100">
                          <Ban className="size-4" />
                          Bloquear
                        </button>
                      ) : null}
                      {canUndoStart ? (
                        <button type="button" onClick={() => updateStep(order, step, "pending")} disabled={pendingAction} className="btn btn-secondary h-9">
                          <Undo2 className="size-4" />
                          Deshacer
                        </button>
                      ) : null}
                      {canUndoFinish ? (
                        <button type="button" onClick={() => updateStep(order, step, "active")} disabled={pendingAction} className="btn h-9 border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100">
                          <RotateCcw className="size-4" />
                          Reabrir
                        </button>
                      ) : null}
                      {canUndoBlock ? (
                        <button type="button" onClick={() => updateStep(order, step, "pending")} disabled={pendingAction} className="btn btn-secondary h-9">
                          <Undo2 className="size-4" />
                          Quitar bloqueo
                        </button>
                      ) : null}
                      <Link href={`/taller/orders/${order.id}`} className="btn btn-secondary h-9">
                        Detalle
                        <ChevronRight className="size-4" />
                      </Link>
                      <OrderLabelPrintButton order={order} groupOrders={groupOrders(workingOrders, order)} className="h-9" />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!visible.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-stone-500">
                  {workerAreas(user).length
                    ? "No hay trabajos activos para tu etapa en este momento."
                    : "Tu usuario no tiene una etapa asignada. Pide al administrador que configure tu perfil."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-4 md:hidden">
        {visible.map((order) => {
          const step = workerActionStep(user, order);
          if (!step) return null;
          const canStart = permissions.canStart && (step.status === "pending" || step.status === "blocked");
          const canFinish = permissions.canComplete && step.status === "active";
          const canBlock = permissions.canBlock && (step.status === "pending" || step.status === "active");
          const canUndoStart = permissions.canStart && step.status === "active";
          const canUndoFinish = permissions.canComplete && step.status === "done";
          const canUndoBlock = permissions.canBlock && step.status === "blocked";
          const isPendingForOrder = pendingAction && pendingTarget?.orderId === order.id;
          return (
            <article key={order.id} className="rounded-lg border border-stone-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-semibold">{order.code}</p>
                    <StatusBadge type="step" value={step.status} />
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-stone-950">{order.product}</h3>
                  <p className="mt-1 text-sm text-stone-600">{order.material} / {order.color}</p>
                </div>
                <div className="shrink-0 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 sm:text-right">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">Entrega</p>
                  <p className="mt-1 text-sm font-semibold">{formatDate(order.deliveryDate)}</p>
                  <p className="text-xs font-semibold text-rose-600">{deliveryLabel(order.deliveryDate, false)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 rounded-md border border-stone-200 bg-stone-50 p-3 sm:grid-cols-3">
                <Info label="Etapa" value={step.label} />
                <Info label="Responsable" value={step.owner} />
                <Info label="Inicio" value={formatDateTime(step.startedAt)} />
              </div>

              {step.notes ? (
                <p className="mt-3 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600">{step.notes}</p>
              ) : null}

              {step.status === "done" ? (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                  Etapa terminada. Puedes reabrirla durante 30 minutos si fue un error, siempre que la etapa siguiente no haya comenzado.
                </p>
              ) : null}

              <label className="mt-4 block">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
                  <MessageSquare className="size-3.5" />
                  {permissions.canBlock ? "Comentario o motivo de bloqueo" : "Comentario opcional"}
                </span>
                <textarea
                  value={comments[order.id] ?? ""}
                  onChange={(event) => setComments((current) => ({ ...current, [order.id]: event.target.value }))}
                  maxLength={500}
                  placeholder="Ej. falta material para continuar"
                  className="textarea-control mt-2 min-h-20 bg-white"
                />
              </label>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
                {canStart ? (
                  <button
                    type="button"
                    onClick={() => updateStep(order, step, "active")}
                    disabled={pendingAction}
                    className="btn h-12 bg-stone-950 text-base text-white hover:bg-stone-800"
                  >
                    <Play className="size-5" />
                    {isPendingForOrder && pendingTarget?.status === "active" ? "Empezando..." : "Empezar"}
                  </button>
                ) : null}
                {canFinish ? (
                  <button
                    type="button"
                    onClick={() => updateStep(order, step, "done")}
                    disabled={pendingAction}
                    className="btn h-12 border border-emerald-200 bg-emerald-50 text-base text-emerald-800 hover:bg-emerald-100"
                  >
                    <Check className="size-5" />
                    {isPendingForOrder && pendingTarget?.status === "done" ? "Terminando..." : "Terminar"}
                  </button>
                ) : null}
                {canBlock ? (
                  <button
                    type="button"
                    onClick={() => updateStep(order, step, "blocked")}
                    disabled={pendingAction}
                    className="btn h-12 border border-rose-200 bg-rose-50 text-sm text-rose-800 hover:bg-rose-100"
                  >
                    <Ban className="size-4" />
                    {isPendingForOrder && pendingTarget?.status === "blocked" ? "Bloqueando..." : "Bloquear"}
                  </button>
                ) : null}
                {canUndoStart ? (
                  <button
                    type="button"
                    onClick={() => updateStep(order, step, "pending")}
                    disabled={pendingAction}
                    className="btn btn-secondary h-12 text-sm"
                  >
                    <Undo2 className="size-4" />
                    Deshacer inicio
                  </button>
                ) : null}
                {canUndoFinish ? (
                  <button
                    type="button"
                    onClick={() => updateStep(order, step, "active")}
                    disabled={pendingAction}
                    className="btn h-12 border border-amber-200 bg-amber-50 text-sm text-amber-800 hover:bg-amber-100"
                  >
                    <RotateCcw className="size-4" />
                    Reabrir etapa
                  </button>
                ) : null}
                {canUndoBlock ? (
                  <button
                    type="button"
                    onClick={() => updateStep(order, step, "pending")}
                    disabled={pendingAction}
                    className="btn btn-secondary h-12 text-sm"
                  >
                    <Undo2 className="size-4" />
                    Quitar bloqueo
                  </button>
                ) : null}
                {!canStart && !canFinish && !canBlock && !canUndoStart && !canUndoFinish && !canUndoBlock ? (
                  <div className="flex h-12 items-center rounded-md border border-stone-200 bg-stone-50 px-3 text-sm text-stone-500 sm:col-span-2">
                    Esperando movimiento anterior.
                  </div>
                ) : null}
                <Link href={`/taller/orders/${order.id}`} className="btn btn-secondary h-12">
                  Detalle
                  <ChevronRight className="size-4" />
                </Link>
                <OrderLabelPrintButton order={order} groupOrders={groupOrders(workingOrders, order)} className="h-12 justify-center" />
              </div>
            </article>
          );
        })}
        {!visible.length ? (
          <div className="empty-state text-left">
            {workerAreas(user).length
              ? "No hay trabajos activos para tu etapa en este momento."
              : "Tu usuario no tiene una etapa asignada. Pide al administrador que configure tu perfil."}
          </div>
        ) : null}
      </div>

      <div className="border-t border-stone-200 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-stone-950">Próximos trabajos</h3>
            <p className="text-sm text-stone-500">Carga futura para planificar materiales y semana.</p>
          </div>
          <span className="inline-flex h-8 w-fit items-center rounded-full border border-stone-200 bg-white px-3 text-xs font-medium text-stone-600">
            {future.length} futuros
          </span>
        </div>
        <div className="mt-3 grid gap-2">
          {future.slice(0, 8).map((order) => {
            const futureStep = order.steps.find((step) => workerAreas(user).includes(step.key) && step.status === "pending");
            return (
              <Link key={order.id} href={`/taller/orders/${order.id}`} className="flex min-w-0 flex-col gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-3 transition hover:border-stone-300 hover:bg-white sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-semibold">{order.code}</p>
                  <p className="mt-1 truncate text-sm font-medium text-stone-800">{order.product}</p>
                  <p className="mt-1 truncate text-xs text-stone-500">{order.material} / {order.color}</p>
                </div>
                <div className="shrink-0 sm:text-right">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">{futureStep?.label ?? "Etapa futura"}</p>
                  <p className="mt-1 text-sm font-semibold text-stone-900">{formatDate(order.deliveryDate)}</p>
                  <p className="text-xs font-semibold text-stone-500">{deliveryLabel(order.deliveryDate, false)}</p>
                </div>
              </Link>
            );
          })}
          {!future.length ? (
            <p className="rounded-md border border-dashed border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
              No hay trabajos futuros para tu etapa.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-stone-900">{value}</p>
    </div>
  );
}

function rowTone(order: Order, step: ProductionStep) {
  if (step.status === "done" || order.status === "completed") return "bg-emerald-50/70";
  if (step.status === "active") return "bg-sky-50/70";
  if (step.status === "blocked" || deliveryLabel(order.deliveryDate, false).startsWith("Vencido")) return "bg-rose-50/70";
  return "bg-white";
}

function groupOrders(orders: Order[], order: Order) {
  return orders.filter((item) => item.status !== "cancelled" && item.groupCode === order.groupCode);
}
