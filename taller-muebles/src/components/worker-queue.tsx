"use client";

import { Check, CheckCircle2, ChevronRight, Pause, Play, Search, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { updateProductionStep } from "@/app/taller/actions";
import type { AreaKey, Order, ProductionStep, Role, StepStatus } from "@/lib/types";
import { deliveryLabel, formatDate } from "@/lib/utils";
import { filterWorkerOrders, nextWorkStep } from "@/lib/workshop-access";
import { StatusBadge } from "./status-badge";

type WorkerQueueProps = {
  orders: Order[];
  user: {
    name: string;
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

function stepTone(step?: ProductionStep) {
  if (!step) return "border-emerald-100 bg-emerald-50/20";
  if (step.status === "blocked") return "border-rose-200/60 bg-rose-50/20";
  if (step.status === "active") return "border-blue-200/60 bg-blue-50/20";
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
  
  const areas = useMemo(() => {
    if (user.role === "operator" && user.area) return [assignedArea];
    return [
      "Todos",
      ...Array.from(new Set(workingOrders.flatMap((order) => order.steps.map((step) => step.label)))),
    ];
  }, [assignedArea, user.area, user.role, workingOrders]);

  const visible = useMemo(() => {
    return filterWorkerOrders(user, workingOrders).filter((order) => {
      const step = nextWorkStep(order);
      const matchesArea = area === "Todos" || step?.label === area;
      const text = `${order.code} ${order.client} ${order.product}`.toLowerCase();
      return matchesArea && text.includes(query.toLowerCase());
    });
  }, [area, workingOrders, query, user]);

  function updateStep(order: Order, status: StepStatus, reason?: string) {
    const step = nextWorkStep(order);
    if (!step) return;

    setPendingTarget({ orderId: order.id, status });
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
        setPendingTarget(null);
        return;
      }

      setFeedback({ tone: "error", text: `${order.code}: ${result.message}` });
      setPendingTarget(null);
    });
  }

  return (
    <section className="min-w-0 rounded-2xl border border-stone-200/60 bg-white shadow-sm shadow-stone-100/50">
      <div className="border-b border-stone-200/55 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between select-none">
          <div>
            <h2 className="text-xl font-serif font-medium text-stone-900">Cola de trabajo</h2>
            <p className="text-xs text-stone-400 font-medium mt-1">Control operativo para iniciar, terminar o bloquear etapas.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <label className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400 pointer-events-none" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 w-full rounded-lg border border-stone-200 bg-stone-50/50 pl-9 pr-3 text-xs font-medium outline-none focus:border-stone-400 focus:bg-white transition"
                placeholder="Buscar orden..."
              />
            </label>
            {query || area !== assignedArea ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setArea(assignedArea);
                }}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-600 transition hover:bg-stone-50"
              >
                <X className="size-3.5" />
                Limpiar
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5 select-none">
          {areas.map((item) => (
            <button
              key={item}
              onClick={() => setArea(item)}
              className={
                area === item
                  ? "h-9 rounded-lg bg-stone-950 px-3.5 text-xs font-bold text-white shadow-sm transition"
                  : "h-9 rounded-lg border border-stone-200 bg-white px-3.5 text-xs font-semibold text-stone-500 hover:text-stone-800 transition"
              }
            >
              {item}
            </button>
          ))}
        </div>
        
        {feedback ? (
          <div role="status" className={`mt-4 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2 text-xs font-semibold ${feedback.tone === "success" ? "border-emerald-250/20 bg-emerald-50 text-emerald-800" : "border-rose-250/20 bg-rose-50 text-rose-800"}`}>
            <span className="inline-flex items-center gap-2">
              {feedback.tone === "success" ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
              {feedback.text}
            </span>
            <button type="button" onClick={() => setFeedback(null)} aria-label="Ocultar mensaje" className="grid size-7 place-items-center rounded-lg hover:bg-white/60">
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}
        
        <p className="mt-3.5 text-[10px] text-stone-400 font-bold uppercase tracking-wider select-none">
          {visible.length} {visible.length === 1 ? "trabajo visible" : "trabajos visibles"} en {area}.
        </p>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-2">
        {visible.map((order) => {
          const step = nextWorkStep(order);
          const canActivate = permissions.canStart && (step?.status === "pending" || step?.status === "blocked");
          const canComplete = permissions.canComplete && step?.status === "active";
          const canBlock = permissions.canBlock && (step?.status === "pending" || step?.status === "active");
          const isPendingForOrder = pendingAction && pendingTarget?.orderId === order.id;
          return (
            <article key={order.id} className={`min-w-0 rounded-2xl border p-4.5 flex flex-col justify-between transition shadow-sm hover:shadow-md ${stepTone(step)}`}>
              <div>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-bold text-stone-900">{order.code}</p>
                      <StatusBadge type="order" value={order.status} />
                    </div>
                    <h3 className="mt-3.5 truncate text-base font-bold text-stone-900">{order.client}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-stone-500 font-medium">{order.product}</p>
                    <p className="mt-1 truncate text-xs text-stone-400 font-semibold">
                      {order.material} / {order.color}
                    </p>
                  </div>
                  <div className="shrink-0 text-right select-none">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
                      Entrega
                    </p>
                    <p className="mt-1.5 text-xs font-bold text-stone-850">{formatDate(order.deliveryDate)}</p>
                    <p className="text-[10px] font-semibold text-rose-600 mt-0.5">
                      {deliveryLabel(order.deliveryDate, order.status === "completed")}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/60 bg-white/70 p-3.5">
                  <div className="flex items-center justify-between gap-3 select-none">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
                        Proceso actual
                      </p>
                      <p className="mt-1 text-sm font-bold text-stone-850">
                        {step ? step.label : "Sin pendientes"}
                      </p>
                      <p className="text-xs text-stone-450 font-medium mt-0.5">
                        {step ? step.owner : "Listo para cierre"}
                      </p>
                      {step?.notes ? (
                        <p className="mt-2 text-xs font-semibold text-rose-700">{step.notes}</p>
                      ) : null}
                    </div>
                    {step ? <StatusBadge type="step" value={step.status} /> : null}
                  </div>
                </div>
              </div>

              <div className="mt-4.5 flex flex-wrap gap-2 pt-3.5 border-t border-stone-250/10">
                {canActivate ? <button
                  onClick={() => updateStep(order, "active")}
                  disabled={pendingAction}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-stone-950 px-3.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-stone-900 active:scale-[0.98] disabled:opacity-50 transition"
                >
                  <Play className="size-3.5" />
                  {isPendingForOrder && pendingTarget?.status === "active" ? "Actualizando..." : step?.status === "blocked" ? "Reanudar" : "Iniciar"}
                </button> : null}
                {canComplete ? <button
                  onClick={() => updateStep(order, "done")}
                  disabled={pendingAction}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 text-xs font-bold uppercase tracking-wider text-emerald-800 hover:bg-emerald-100/50 active:scale-[0.98] disabled:opacity-50 transition"
                >
                  <Check className="size-3.5" />
                  {isPendingForOrder && pendingTarget?.status === "done" ? "Terminando..." : "Terminar"}
                </button> : null}
                {canBlock ? <button
                  onClick={() => permissions.requireBlockReason ? setBlockTarget(order) : updateStep(order, "blocked")}
                  disabled={pendingAction}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3.5 text-xs font-bold uppercase tracking-wider text-rose-700 hover:bg-stone-50 active:scale-[0.98] disabled:opacity-50 transition"
                >
                  <Pause className="size-3.5" />
                  {isPendingForOrder && pendingTarget?.status === "blocked" ? "Bloqueando..." : "Bloquear"}
                </button> : null}
                <Link
                  href={user.role === "operator" ? `/taller/orders/${order.id}` : `/admin/orders/${order.id}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 text-xs font-bold text-stone-600 transition hover:bg-stone-50 hover:text-stone-950 sm:ml-auto"
                >
                  Detalle
                  <ChevronRight className="size-3.5 text-stone-400" />
                </Link>
              </div>
            </article>
          );
        })}
        {!visible.length ? (
          <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/50 p-6 text-xs text-stone-400 font-bold uppercase tracking-widest text-center xl:col-span-2">
            {query
              ? `No hay trabajos para "${query}".`
              : `Sin trabajos para ${area}.`}
          </div>
        ) : null}
      </div>
      
      {blockTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-stone-950/45 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="block-title" className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600">Bloqueo productivo</p>
                <h3 id="block-title" className="mt-2 text-xl font-serif font-medium text-stone-900">Registrar motivo del bloqueo</h3>
                <p className="mt-1.5 text-xs text-stone-500 font-medium">
                  {blockTarget.code} · {nextWorkStep(blockTarget)?.label}. El motivo quedará visible para administración.
                </p>
              </div>
              <button type="button" onClick={() => setBlockTarget(null)} aria-label="Cerrar" className="grid size-9 shrink-0 place-items-center rounded-full border border-stone-200 text-stone-400 hover:text-stone-850 hover:bg-stone-55">
                <X className="size-4" />
              </button>
            </div>
            <label className="mt-5 block text-xs font-bold text-stone-600 tracking-wide">
              Motivo
              <textarea
                autoFocus
                value={blockReason}
                onChange={(event) => setBlockReason(event.target.value)}
                maxLength={300}
                placeholder="Ej. Falta cuero color coñac para continuar."
                className="mt-2 min-h-28 w-full resize-none rounded-xl border border-stone-200 bg-stone-50/30 p-3.5 text-sm outline-none transition-all focus:border-stone-400 focus:bg-white"
              />
              <span className="mt-2 flex items-center justify-between gap-3 text-[10px]">
                <span className={blockReason.trim().length < 5 ? "text-rose-600 font-semibold" : "text-stone-400 font-medium"}>
                  Mínimo 5 caracteres para trazabilidad.
                </span>
                <span className="font-bold text-stone-400">{blockReason.trim().length}/300</span>
              </span>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setBlockTarget(null)} className="h-10 rounded-lg border border-stone-200 bg-white px-4 text-xs font-bold text-stone-700 hover:bg-stone-50 transition">
                Cancelar
              </button>
              <button
                type="button"
                disabled={pendingAction || blockReason.trim().length < 5}
                onClick={() => updateStep(blockTarget, "blocked", blockReason.trim())}
                className="h-10 rounded-lg bg-rose-700 px-4 text-xs font-bold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50 transition"
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
  const labels: Record<string, string> = {
    structure: "Estructura",
    cutting: "Corte",
    sewing: "Costura",
    upholstery: "Tapicería",
    quality: "Revisión",
  };
  return labels[area] ?? area;
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
