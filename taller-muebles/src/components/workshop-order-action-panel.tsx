"use client";

import { Ban, Check, Play, RotateCcw, Undo2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { updateProductionStep } from "@/app/taller/actions";
import type { AreaKey, StepStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type WorkshopOrderActionPanelProps = {
  orderId: string;
  orderCode: string;
  step?: {
    key: AreaKey;
    label: string;
    status: StepStatus;
    notes?: string;
  };
  canStart: boolean;
  canComplete: boolean;
  canBlock: boolean;
  canReopen?: boolean;
  requireBlockReason: boolean;
};

export function WorkshopOrderActionPanel({
  orderId,
  orderCode,
  step,
  canStart,
  canComplete,
  canBlock,
  canReopen = true,
  requireBlockReason,
}: WorkshopOrderActionPanelProps) {
  const [statusOverride, setStatusOverride] = useState<StepStatus | null>(null);
  const [reason, setReason] = useState(step?.notes ?? "");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pendingTarget, setPendingTarget] = useState<StepStatus | null>(null);
  const [pending, startTransition] = useTransition();

  if (!step) {
    return (
      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <p className="text-sm font-semibold text-stone-950">Este pedido todavía no requiere acción tuya.</p>
        <p className="mt-1 text-sm text-stone-500">Puedes revisar la información, pero la etapa asignada aún no está lista para operar.</p>
      </section>
    );
  }

  const activeStep = step;
  const status = statusOverride ?? step.status;
  const canStartStep = canStart && (status === "pending" || status === "blocked");
  const canFinishStep = canComplete && status === "active";
  const canBlockStep = canBlock && (status === "pending" || status === "active");
  const canUndoStart = canStart && status === "active";
  const canUndoFinish = canReopen && canComplete && status === "done";
  const canUndoBlock = canBlock && status === "blocked";

  function move(nextStatus: StepStatus) {
    const trimmedReason = reason.trim();
    if (nextStatus === "blocked" && requireBlockReason && trimmedReason.length < 5) {
      setFeedback({ tone: "error", text: "Escribe un motivo de bloqueo de al menos 5 caracteres." });
      return;
    }

    setFeedback(null);
    setPendingTarget(nextStatus);
    startTransition(async () => {
      const result = await updateProductionStep({
        orderId,
        stepKey: activeStep.key,
        status: nextStatus,
        reason: trimmedReason || undefined,
      });

      if (result.status === "success") {
        setStatusOverride(nextStatus);
        setFeedback({ tone: "success", text: `${orderCode}: ${activeStep.label} actualizado.` });
      } else {
        setFeedback({ tone: "error", text: result.message });
      }
      setPendingTarget(null);
    });
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm shadow-stone-950/5 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Tu etapa</p>
          <h2 className="mt-1 truncate text-xl font-semibold text-stone-950">{step.label}</h2>
        </div>
        <StepPill status={status} />
      </div>

      {feedback ? (
        <div
          role="status"
          className={cn(
            "mt-3 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm font-medium",
            feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800",
          )}
        >
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} aria-label="Ocultar mensaje" className="grid size-7 shrink-0 place-items-center rounded-md hover:bg-white/70">
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {canStartStep ? (
          <button type="button" disabled={pending} onClick={() => move("active")} className="work-action work-action-primary">
            <Play className="size-5 fill-current" />
            {pendingTarget === "active" ? "Iniciando" : "Iniciar"}
          </button>
        ) : null}
        {canFinishStep ? (
          <button type="button" disabled={pending} onClick={() => move("done")} className="work-action border-blue-300 bg-white text-blue-700 hover:bg-blue-50">
            <Check className="size-5" />
            {pendingTarget === "done" ? "Terminando" : "Terminar"}
          </button>
        ) : null}
        {canUndoStart ? (
          <button type="button" disabled={pending} onClick={() => move("pending")} className="work-action border-stone-200 bg-white text-stone-800 hover:bg-stone-50">
            <Undo2 className="size-5" />
            Deshacer inicio
          </button>
        ) : null}
        {canUndoFinish ? (
          <button type="button" disabled={pending} onClick={() => move("pending")} className="work-action border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100">
            <RotateCcw className="size-5" />
            Reabrir
          </button>
        ) : null}
        {canUndoBlock ? (
          <button type="button" disabled={pending} onClick={() => move("pending")} className="work-action border-stone-200 bg-white text-stone-800 hover:bg-stone-50">
            <Undo2 className="size-5" />
            Quitar bloqueo
          </button>
        ) : null}
      </div>

      {canBlockStep ? (
        <details className="mt-3 rounded-md border border-stone-200 bg-stone-50">
          <summary className="cursor-pointer list-none px-3 py-3 text-sm font-semibold text-stone-700">
            Bloquear etapa
          </summary>
          <div className="border-t border-stone-200 p-3">
            <label className="block">
              <span className="field-label">{requireBlockReason ? "Motivo requerido" : "Nota opcional"}</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                placeholder="Ej. falta material o medida por confirmar"
                className="textarea-control mt-2 min-h-16 bg-white"
              />
            </label>
            <button type="button" disabled={pending} onClick={() => move("blocked")} className="btn mt-3 h-11 w-full border border-rose-200 bg-white text-rose-700 hover:bg-rose-50">
              <Ban className="size-4" />
              {pendingTarget === "blocked" ? "Bloqueando" : "Bloquear"}
            </button>
          </div>
        </details>
      ) : null}
    </section>
  );
}

function StepPill({ status }: { status: StepStatus }) {
  const labels: Record<StepStatus, string> = {
    pending: "Por iniciar",
    active: "En proceso",
    done: "Listo",
    blocked: "Bloqueado",
  };
  const classes: Record<StepStatus, string> = {
    pending: "border-stone-200 bg-stone-50 text-stone-700",
    active: "border-blue-200 bg-blue-50 text-blue-700",
    done: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blocked: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <span className={cn("inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-semibold", classes[status])}>
      {labels[status]}
    </span>
  );
}
