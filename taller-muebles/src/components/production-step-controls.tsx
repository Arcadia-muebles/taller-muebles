"use client";

import { Check, Play, RotateCcw, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import { updateProductionStep } from "@/app/taller/actions";
import type { AreaKey, StepStatus } from "@/lib/types";

export function ProductionStepControls({
  orderId,
  stepKey,
  status,
}: {
  orderId: string;
  stepKey: AreaKey;
  status: StepStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function move(nextStatus: StepStatus) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateProductionStep({ orderId, stepKey, status: nextStatus });
      setMessage(result.status === "error" ? result.message : null);
    });
  }

  return (
    <div className="flex max-w-md flex-wrap justify-end gap-2">
      {(status === "pending" || status === "blocked") ? (
        <button type="button" disabled={pending} onClick={() => move("active")} className="btn btn-secondary h-8 text-xs">
          <Play className="size-3.5" />
          Empezar
        </button>
      ) : null}
      {status === "active" ? (
        <>
          <button type="button" disabled={pending} onClick={() => move("pending")} className="btn btn-secondary h-8 text-xs">
            <Undo2 className="size-3.5" />
            Deshacer inicio
          </button>
          <button type="button" disabled={pending} onClick={() => move("done")} className="btn h-8 border border-emerald-200 bg-emerald-50 text-xs text-emerald-800 hover:bg-emerald-100">
            <Check className="size-3.5" />
            Terminar
          </button>
        </>
      ) : null}
      {status === "done" ? (
        <button type="button" disabled={pending} onClick={() => move("active")} className="btn h-8 border border-amber-200 bg-amber-50 text-xs text-amber-800 hover:bg-amber-100">
          <RotateCcw className="size-3.5" />
          Reabrir etapa
        </button>
      ) : null}
      {status === "blocked" ? (
        <button type="button" disabled={pending} onClick={() => move("pending")} className="btn btn-secondary h-8 text-xs">
          <Undo2 className="size-3.5" />
          Quitar bloqueo
        </button>
      ) : null}
      {message ? <p className="w-full text-right text-xs font-medium text-rose-700">{message}</p> : null}
    </div>
  );
}
