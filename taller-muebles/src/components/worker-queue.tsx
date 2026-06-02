"use client";

import { Check, ChevronRight, Pause, Play, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { updateProductionStep } from "@/app/taller/actions";
import type { Order, ProductionStep, StepStatus } from "@/lib/types";
import { deliveryLabel, formatDate } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

type WorkerQueueProps = {
  orders: Order[];
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

export function WorkerQueue({ orders }: WorkerQueueProps) {
  const [area, setArea] = useState("Todos");
  const [query, setQuery] = useState("");
  const [overrides, setOverrides] = useState<Record<string, StepStatus>>({});
  const [feedback, setFeedback] = useState("");
  const [pendingAction, startTransition] = useTransition();

  const areas = ["Todos", "Estructura", "Corte", "Costura", "Tapiceria", "Revision"];
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

  function updateStep(order: Order, status: StepStatus) {
    const step = nextStep(order);
    if (!step) return;

    startTransition(async () => {
      const result = await updateProductionStep({
        orderId: order.id,
        stepKey: step.key,
        status,
      });

      if (result.status === "success") {
        setOverrides((current) => ({
          ...current,
          [`${order.id}:${step.key}`]: status,
        }));
        setFeedback(`${order.code}: ${step.label} actualizado a ${statusLabel(status)}.`);
        return;
      }

      setFeedback(`${order.code}: ${result.message}`);
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
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            {feedback}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 p-4 xl:grid-cols-2">
        {visible.map((order) => {
          const step = nextStep(order);
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
                  </div>
                  {step ? <StatusBadge type="step" value={step.status} /> : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => updateStep(order, "active")}
                  disabled={pendingAction}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Play className="size-4" />
                  Iniciar
                </button>
                <button
                  onClick={() => updateStep(order, "done")}
                  disabled={pendingAction}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Check className="size-4" />
                  Terminar
                </button>
                <button
                  onClick={() => updateStep(order, "blocked")}
                  disabled={pendingAction}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-rose-200 bg-white px-3 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Pause className="size-4" />
                  Bloquear
                </button>
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="ml-auto inline-flex h-10 items-center gap-1 rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-600"
                >
                  Detalle
                  <ChevronRight className="size-4" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
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
