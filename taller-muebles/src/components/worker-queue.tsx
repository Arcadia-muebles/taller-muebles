"use client";

import { Check, ChevronRight, MessageSquare, Play, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { updateProductionStep } from "@/app/taller/actions";
import type { AreaKey, Order, ProductionStep, Role, StepStatus } from "@/lib/types";
import { deliveryLabel, formatDate, formatDateTime } from "@/lib/utils";
import { filterWorkerOrders, nextWorkStep } from "@/lib/workshop-access";
import { workerAreas } from "@/lib/workshop-access";
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
};

export function WorkerQueue({ orders, user, permissions }: WorkerQueueProps) {
  const [overrides, setOverrides] = useState<Record<string, StepStatus>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pendingTarget, setPendingTarget] = useState<{ orderId: string; status: StepStatus } | null>(null);
  const [pendingAction, startTransition] = useTransition();

  const workingOrders = useMemo(
    () =>
      orders.map((order) => ({
        ...order,
        steps: order.steps.map((step) => ({
          ...step,
          status: overrides[`${order.id}:${step.key}`] ?? step.status,
        })),
      })),
    [orders, overrides],
  );

  const visible = useMemo(() => filterWorkerOrders(user, workingOrders), [user, workingOrders]);
  const areaName = workerAreas(user)
    .map((area) => visible[0]?.steps.find((step) => step.key === area)?.label ?? area)
    .join(", ") || "Sin etapa";

  function updateStep(order: Order, step: ProductionStep, status: StepStatus) {
    const comment = comments[order.id]?.trim();
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
            {visible.length} pendientes
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

      <div className="grid gap-3 p-4">
        {visible.map((order) => {
          const step = nextWorkStep(order);
          if (!step) return null;
          const canStart = permissions.canStart && (step.status === "pending" || step.status === "blocked");
          const canFinish = permissions.canComplete && step.status === "active";
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

              <label className="mt-4 block">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
                  <MessageSquare className="size-3.5" />
                  Comentario opcional
                </span>
                <textarea
                  value={comments[order.id] ?? ""}
                  onChange={(event) => setComments((current) => ({ ...current, [order.id]: event.target.value }))}
                  maxLength={500}
                  placeholder="Ej. se termino costura sin observaciones"
                  className="textarea-control mt-2 min-h-20 bg-white"
                />
              </label>

              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
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
                {!canStart && !canFinish ? (
                  <div className="flex h-12 items-center rounded-md border border-stone-200 bg-stone-50 px-3 text-sm text-stone-500 sm:col-span-2">
                    Esperando movimiento anterior.
                  </div>
                ) : null}
                <Link href={`/taller/orders/${order.id}`} className="btn btn-secondary h-12">
                  Detalle
                  <ChevronRight className="size-4" />
                </Link>
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
