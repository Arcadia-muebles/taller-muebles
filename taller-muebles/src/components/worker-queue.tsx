"use client";

import { Check, ChevronRight, Clock3, History, MessageSquare, Play, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { updateProductionStep } from "@/app/taller/actions";
import type { AreaKey, Order, ProductionStep, Role, StepStatus, SystemSettings } from "@/lib/types";
import { deliveryLabel, durationLabel, formatDate, formatDateTime, stepWorkSessions, totalDurationLabel } from "@/lib/utils";
import { nextWorkStep, workerAreas, workerStep } from "@/lib/workshop-access";
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
  productionSteps: SystemSettings["production"]["steps"];
};

type TabKey = "now" | "upcoming" | "history";
type WorkerItem = { order: Order; step: ProductionStep; current?: ProductionStep };

const tabs: Array<{ key: TabKey; label: string; icon: React.ElementType }> = [
  { key: "now", label: "Ahora", icon: Play },
  { key: "upcoming", label: "Proximos", icon: Clock3 },
  { key: "history", label: "Historial", icon: History },
];

export function WorkerQueue({ orders, user, permissions, productionSteps }: WorkerQueueProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("now");
  const [statusOverrides, setStatusOverrides] = useState<Record<string, StepStatus>>({});
  const [noteOverrides, setNoteOverrides] = useState<Record<string, string>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pendingTarget, setPendingTarget] = useState<{ orderId: string; stepKey: string; action: string } | null>(null);
  const [pendingAction, startTransition] = useTransition();

  const workingOrders = useMemo(
    () =>
      orders.map((order) => ({
        ...order,
        steps: order.steps.map((step) => {
          const key = stepKey(order.id, step.key);
          return {
            ...step,
            status: statusOverrides[key] ?? step.status,
            notes: noteOverrides[key] ?? step.notes,
          };
        }),
      })),
    [orders, statusOverrides, noteOverrides],
  );

  const productionStepLabels = useMemo(
    () => new Map(productionSteps.map((step) => [step.key, step.label])),
    [productionSteps],
  );
  const areaName = workerAreas(user)
    .map((area) => productionStepLabels.get(area) ?? area)
    .join(", ") || "Sin etapa";

  const categorized = useMemo(() => {
    const now: WorkerItem[] = [];
    const upcoming: WorkerItem[] = [];
    const history: WorkerItem[] = [];

    for (const order of workingOrders) {
      const step = workerStep(user, order);
      if (!step) continue;
      const current = nextWorkStep(order);
      const closed = ["completed", "cancelled"].includes(order.status);

      if (step.status === "done" || closed) {
        history.push({ order, step });
      } else if (current?.key === step.key || step.status === "active" || step.status === "blocked") {
        now.push({ order, step });
      } else {
        upcoming.push({ order, step, current });
      }
    }

    const byDelivery = (a: { order: Order }, b: { order: Order }) =>
      (a.order.deliveryDate ?? "9999-12-31").localeCompare(b.order.deliveryDate ?? "9999-12-31");

    return {
      now: now.sort(byDelivery),
      upcoming: upcoming.sort(byDelivery),
      history: history.sort((a, b) => (b.step.completedAt ?? "").localeCompare(a.step.completedAt ?? "")),
    };
  }, [user, workingOrders]);

  const items = categorized[activeTab];

  function noteValue(order: Order, step: ProductionStep) {
    const key = stepKey(order.id, step.key);
    return draftNotes[key] ?? step.notes ?? "";
  }

  function setNote(order: Order, step: ProductionStep, value: string) {
    setDraftNotes((current) => ({ ...current, [stepKey(order.id, step.key)]: value }));
  }

  function updateStep(order: Order, step: ProductionStep, status: StepStatus, action: string, noteOnly = false) {
    const key = stepKey(order.id, step.key);
    const reason = noteValue(order, step).trim();
    setPendingTarget({ orderId: order.id, stepKey: step.key, action });
    startTransition(async () => {
      const result = await updateProductionStep({
        orderId: order.id,
        stepKey: step.key,
        status,
        reason: reason || undefined,
        noteOnly,
      });

      if (result.status === "success") {
        setStatusOverrides((current) => noteOnly ? current : { ...current, [key]: status });
        setNoteOverrides((current) => ({ ...current, [key]: reason }));
        setFeedback({ tone: "success", text: `${order.code}: cambios guardados.` });
      } else {
        setFeedback({ tone: "error", text: `${order.code}: ${result.message}` });
      }
      setPendingTarget(null);
    });
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="panel-title">Mis productos</h2>
            <p className="panel-description">Etapa asignada: {areaName}</p>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-stone-200 bg-stone-50 p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition sm:px-3 ${
                    selected ? "bg-stone-950 text-white shadow-sm" : "text-stone-600 hover:bg-white"
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{tab.label}</span>
                  <span className={selected ? "text-stone-300" : "text-stone-400"}>{categorized[tab.key].length}</span>
                </button>
              );
            })}
          </div>
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

      <div className="grid gap-3 p-3 sm:p-4">
        {items.map(({ order, step, current }) => (
          <WorkerProductCard
            key={`${order.id}:${step.key}`}
            order={order}
            step={step}
            current={current}
            tab={activeTab}
            note={noteValue(order, step)}
            onNoteChange={(value) => setNote(order, step, value)}
            onUpdate={(status, action, noteOnly) => updateStep(order, step, status, action, noteOnly)}
            permissions={permissions}
            pending={pendingAction && pendingTarget?.orderId === order.id && pendingTarget.stepKey === step.key ? pendingTarget.action : null}
          />
        ))}
        {!items.length ? <EmptyState tab={activeTab} hasAreas={Boolean(workerAreas(user).length)} /> : null}
      </div>
    </section>
  );
}

function WorkerProductCard({
  order,
  step,
  current,
  tab,
  note,
  onNoteChange,
  onUpdate,
  permissions,
  pending,
}: {
  order: Order;
  step: ProductionStep;
  current?: ProductionStep;
  tab: TabKey;
  note: string;
  onNoteChange: (value: string) => void;
  onUpdate: (status: StepStatus, action: string, noteOnly?: boolean) => void;
  permissions: WorkerQueueProps["permissions"];
  pending: string | null;
}) {
  const canStart = tab === "now" && permissions.canStart && (step.status === "pending" || step.status === "blocked");
  const canFinish = tab === "now" && permissions.canComplete && step.status === "active";
  const canReopen = tab === "history" && permissions.canStart && step.status === "done" && !["cancelled"].includes(order.status);
  const canEditNote = tab !== "upcoming";

  return (
    <article className="rounded-lg border border-stone-200 bg-white p-3 sm:p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-sm font-semibold">{order.code}</p>
            <StatusBadge type="step" value={step.status} />
          </div>
          <h3 className="mt-3 truncate text-lg font-semibold text-stone-950">{order.product}</h3>
          <p className="mt-1 truncate text-sm text-stone-600">{order.material} / {order.color}</p>
        </div>
        <div className="shrink-0 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 md:text-right">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">Entrega</p>
          <p className="mt-1 text-sm font-semibold">{formatDate(order.deliveryDate)}</p>
          <p className="text-xs font-semibold text-rose-600">{deliveryLabel(order.deliveryDate, order.status === "completed")}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-md border border-stone-200 bg-stone-50 p-3 sm:grid-cols-3">
        <Info label="Tu etapa" value={step.label} />
        <Info label="Responsable" value={step.owner} />
        <Info label="Tiempo total" value={totalDurationLabel(step)} />
      </div>

      <div className="mt-3 rounded-md border border-stone-200 bg-white p-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">Historial de tiempo</p>
        <div className="mt-2 space-y-2">
          {stepWorkSessions(step).map((session, index) => (
            <div key={`${session.startedAt}:${index}`} className="grid gap-1 text-xs text-stone-600 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
              <span>Inicio: <strong className="font-semibold text-stone-900">{formatDateTime(session.startedAt)}</strong></span>
              <span>Termino: <strong className="font-semibold text-stone-900">{session.completedAt ? formatDateTime(session.completedAt) : "En curso"}</strong></span>
              <span className="font-semibold text-stone-900">{session.completedAt ? durationLabel(session.startedAt, session.completedAt) : "En curso"}</span>
            </div>
          ))}
          {!stepWorkSessions(step).length ? <p className="text-xs text-stone-500">Sin registros de tiempo.</p> : null}
        </div>
      </div>

      {tab === "upcoming" ? (
        <div className="mt-3 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600">
          Antes de tu etapa falta: <span className="font-semibold text-stone-900">{current?.label ?? "movimiento anterior"}</span>.
        </div>
      ) : null}

      <label className="mt-4 block">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
          <MessageSquare className="size-3.5" />
          Comentario de tu etapa
        </span>
        <textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          disabled={!canEditNote}
          maxLength={500}
          placeholder="Ej. terminado sin observaciones"
          className="textarea-control mt-2 min-h-20 bg-white disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        {canStart ? (
          <button type="button" onClick={() => onUpdate("active", "start")} disabled={Boolean(pending)} className="btn h-12 bg-stone-950 text-base text-white hover:bg-stone-800">
            <Play className="size-5" />
            {pending === "start" ? "Empezando..." : "Empezar"}
          </button>
        ) : null}
        {canFinish ? (
          <button type="button" onClick={() => onUpdate("done", "finish")} disabled={Boolean(pending)} className="btn h-12 border border-emerald-200 bg-emerald-50 text-base text-emerald-800 hover:bg-emerald-100">
            <Check className="size-5" />
            {pending === "finish" ? "Terminando..." : "Terminar"}
          </button>
        ) : null}
        {canReopen ? (
          <button type="button" onClick={() => onUpdate("active", "reopen")} disabled={Boolean(pending)} className="btn h-12 border border-amber-200 bg-amber-50 text-base text-amber-900 hover:bg-amber-100">
            <RotateCcw className="size-5" />
            {pending === "reopen" ? "Reabriendo..." : "Reabrir etapa"}
          </button>
        ) : null}
        {canEditNote ? (
          <button type="button" onClick={() => onUpdate(step.status, "note", true)} disabled={Boolean(pending)} className="btn btn-secondary h-12">
            <MessageSquare className="size-4" />
            {pending === "note" ? "Guardando..." : "Guardar comentario"}
          </button>
        ) : null}
        <Link href={`/taller/orders/${order.id}`} className="btn btn-secondary h-12">
          Detalle
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-stone-900">{value}</p>
    </div>
  );
}

function EmptyState({ tab, hasAreas }: { tab: TabKey; hasAreas: boolean }) {
  const text = !hasAreas
    ? "Tu usuario no tiene una etapa asignada. Pide al administrador que configure tu perfil."
    : tab === "now"
      ? "No hay productos listos para trabajar en tu etapa."
      : tab === "upcoming"
        ? "No hay productos futuros en tu cadena por ahora."
        : "Todavia no hay productos terminados por tu etapa.";

  return <div className="empty-state text-left">{text}</div>;
}

function stepKey(orderId: string, area: string) {
  return `${orderId}:${area}`;
}
