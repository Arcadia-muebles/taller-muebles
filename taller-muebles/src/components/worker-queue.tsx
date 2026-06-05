"use client";

import { Check, ChevronRight, Pause, Play, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { updateProductionStep } from "@/app/taller/actions";
import type { AreaKey, Order, ProductionStep, Role, StepStatus } from "@/lib/types";
import { deliveryLabel, formatDate } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

type WorkerQueueProps = {
  orders: Order[];
  user: {
    role: Role;
    area?: AreaKey;
  };
  permissions: {
    canStart: boolean;
    canComplete: boolean;
    canBlock: boolean;
    requireBlockReason: boolean;
  };
};

function nextStep(order: Order) {
  return (
    order.steps.find((step) => step.status === "active") ??
    order.steps.find((step) => step.status === "blocked") ??
    order.steps.find((step) => step.status === "pending")
  );
}

function stepTone(step?: ProductionStep) {
  if (!step) return "border-emerald-200 bg-emerald-50";
  if (step.status === "blocked") return "border-rose-200 bg-rose-50";
  if (step.status === "active") return "border-blue-200 bg-blue-50";
  return "border-stone-200 bg-white";
}

export function WorkerQueue({ orders, user, permissions }: WorkerQueueProps) {
  const assignedArea = user.role === "operator" && user.area ? areaLabel(user.area) : "Todos";
  const [area, setArea] = useState(assignedArea);
  const [query, setQuery] = useState("");
  const [overrides, setOverrides] = useState<Record<string, StepStatus>>({});
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [blockTarget, setBlockTarget] = useState<Order | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [pendingAction, startTransition] = useTransition();

  const areas = user.role === "operator"
    ? [assignedArea]
    : ["Todos", "Estructura", "Corte", "Costura", "Tapiceria", "Revision"];
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

  const visible = useMemo(() => {
    return workingOrders.filter((order) => {
      const step = nextStep(order);
      const matchesArea = area === "Todos" || step?.label === area;
      const text = `${order.code} ${order.client} ${order.product}`.toLowerCase();
      return matchesArea && text.includes(query.toLowerCase());
    });
  }, [area, workingOrders, query]);

  function updateStep(order: Order, status: StepStatus, reason?: string) {
    const step = nextStep(order);
    if (!step) return;

    startTransition(async () => {
      const result = await updateProductionStep({
        orderId: order.id,
        stepKey: step.key,
        status,
        reason,
      });

      if (result.status === "success") {
        setOverrides((current) => ({
          ...current,
          [`${order.id}:${step.key}`]: status,
        }));
        setFeedback({ tone: "success", text: `${order.code}: ${step.label} actualizado a ${statusLabel(status)}.` });
        setBlockTarget(null);
        setBlockReason("");
        return;
      }

      setFeedback({ tone: "error", text: `${order.code}: ${result.message}` });
    });
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white">
      <div className="border-b border-stone-200 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold">Cola de trabajo</h2>
            <p className="text-sm text-stone-500">Vista simplificada para actualizar procesos.</p>
          </div>
          <label className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 w-full rounded-md border border-stone-200 bg-stone-50 pl-9 pr-3 text-sm outline-none focus:border-stone-400 focus:bg-white"
              placeholder="Buscar orden"
            />
          </label>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {areas.map((item) => (
            <button
              key={item}
              onClick={() => setArea(item)}
              className={
                area === item
                  ? "h-9 rounded-md bg-stone-950 px-3 text-sm font-medium text-white"
                  : "h-9 rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-600"
              }
            >
              {item}
            </button>
          ))}
        </div>
        {feedback ? (
          <div role="status" className={`mt-4 rounded-md border px-3 py-2 text-sm font-medium ${feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
            {feedback.text}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 p-4 xl:grid-cols-2">
        {visible.map((order) => {
          const step = nextStep(order);
          const canActivate = permissions.canStart && (step?.status === "pending" || step?.status === "blocked");
          const canComplete = permissions.canComplete && step?.status === "active";
          const canBlock = permissions.canBlock && (step?.status === "pending" || step?.status === "active");
          return (
            <article key={order.id} className={`rounded-lg border p-4 ${stepTone(step)}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-semibold">{order.code}</p>
                    <StatusBadge type="order" value={order.status} />
                  </div>
                  <h3 className="mt-3 truncate text-lg font-semibold">{order.client}</h3>
                  <p className="mt-1 text-sm text-stone-600">{order.product}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {order.material} / {order.color}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
                    Entrega
                  </p>
                  <p className="mt-1 text-sm font-semibold">{formatDate(order.deliveryDate)}</p>
                  <p className="text-xs font-semibold text-rose-600">
                    {deliveryLabel(order.deliveryDate, order.status === "completed")}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-md border border-white/80 bg-white/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
                      Proceso actual
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {step ? step.label : "Sin pendientes"}
                    </p>
                    <p className="text-xs text-stone-500">
                      {step ? step.owner : "Orden lista para cierre"}
                    </p>
                    {step?.notes ? (
                      <p className="mt-2 text-xs font-medium text-rose-700">{step.notes}</p>
                    ) : null}
                  </div>
                  {step ? <StatusBadge type="step" value={step.status} /> : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {canActivate ? <button
                  onClick={() => updateStep(order, "active")}
                  disabled={pendingAction}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Play className="size-4" />
                  {step?.status === "blocked" ? "Reanudar" : "Iniciar"}
                </button> : null}
                {canComplete ? <button
                  onClick={() => updateStep(order, "done")}
                  disabled={pendingAction}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Check className="size-4" />
                  Terminar
                </button> : null}
                {canBlock ? <button
                  onClick={() => permissions.requireBlockReason ? setBlockTarget(order) : updateStep(order, "blocked")}
                  disabled={pendingAction}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-rose-200 bg-white px-3 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Pause className="size-4" />
                  Bloquear
                </button> : null}
                <Link
                  href={user.role === "operator" ? `/taller/orders/${order.id}` : `/admin/orders/${order.id}`}
                  className="ml-auto inline-flex h-10 items-center gap-1 rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-950"
                >
                  Detalle
                  <ChevronRight className="size-4" />
                </Link>
              </div>
            </article>
          );
        })}
        {!visible.length ? (
          <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 p-6 text-sm text-stone-500 xl:col-span-2">
            No hay trabajos disponibles para este filtro.
          </div>
        ) : null}
      </div>
      {blockTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-stone-950/45 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="block-title" className="w-full max-w-lg rounded-xl border border-stone-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-rose-600">Bloqueo productivo</p>
                <h3 id="block-title" className="mt-2 text-xl font-semibold">Registrar motivo del bloqueo</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  {blockTarget.code} · {nextStep(blockTarget)?.label}. El motivo quedará visible para administración.
                </p>
              </div>
              <button type="button" onClick={() => setBlockTarget(null)} aria-label="Cerrar" className="grid size-9 shrink-0 place-items-center rounded-md border border-stone-200 text-stone-500">
                <X className="size-4" />
              </button>
            </div>
            <label className="mt-5 block text-sm font-medium text-stone-700">
              Motivo
              <textarea
                autoFocus
                value={blockReason}
                onChange={(event) => setBlockReason(event.target.value)}
                placeholder="Ej. Falta cuero color coñac para continuar."
                className="mt-2 min-h-28 w-full resize-none rounded-md border border-stone-200 bg-stone-50 p-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setBlockTarget(null)} className="h-10 rounded-md border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700">
                Cancelar
              </button>
              <button
                type="button"
                disabled={pendingAction || blockReason.trim().length < 5}
                onClick={() => updateStep(blockTarget, "blocked", blockReason.trim())}
                className="h-10 rounded-md bg-rose-700 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirmar bloqueo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function areaLabel(area: AreaKey) {
  const labels: Record<AreaKey, string> = {
    structure: "Estructura",
    cutting: "Corte",
    sewing: "Costura",
    upholstery: "Tapiceria",
    quality: "Revision",
  };
  return labels[area];
}

function statusLabel(status: StepStatus) {
  const labels: Record<StepStatus, string> = {
    pending: "pendiente",
    active: "activo",
    done: "terminado",
    blocked: "bloqueado",
  };
  return labels[status];
}
