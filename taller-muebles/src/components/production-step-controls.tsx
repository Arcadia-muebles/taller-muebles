"use client";

import { AlertTriangle, Check, PauseCircle, Play, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateProductionStep } from "@/app/taller/actions";
import type { AreaKey, StepStatus } from "@/lib/types";

export function ProductionStepControls({
  orderId,
  stepKey,
  status,
  reason,
}: {
  orderId: string;
  stepKey: AreaKey;
  status: StepStatus;
  reason?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  function move(nextStatus: StepStatus, nextReason?: string) {
    setFeedback(null);
    startTransition(async () => {
      const result = await updateProductionStep({
        orderId,
        stepKey,
        status: nextStatus,
        reason: nextReason,
      });

      if (result.status === "error") {
        setFeedback({ tone: "error", message: result.message });
        return;
      }

      setShowBlockForm(false);
      setBlockReason("");
      setFeedback({
        tone: "success",
        message: nextStatus === "blocked" ? "Proceso detenido." : nextStatus === "active" ? "Proceso reanudado." : "Etapa terminada.",
      });
      router.refresh();
    });
  }

  function block() {
    const normalizedReason = blockReason.trim();
    if (normalizedReason.length < 5) {
      setFeedback({ tone: "error", message: "Describe brevemente por que se detiene el proceso." });
      return;
    }
    move("blocked", normalizedReason);
  }

  if (status === "done") return null;

  return (
    <div className="w-full space-y-2 md:w-auto">
      {status === "blocked" ? (
        <div className="max-w-md rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <p className="font-semibold">Motivo de la detencion</p>
          <p className="mt-1 leading-5">{reason || "Sin motivo registrado."}</p>
        </div>
      ) : null}

      {showBlockForm ? (
        <div className="max-w-md rounded-md border border-rose-200 bg-rose-50 p-3">
          <label className="block text-xs font-semibold text-rose-900">
            Motivo de la detencion
            <textarea
              value={blockReason}
              onChange={(event) => setBlockReason(event.target.value)}
              disabled={pending}
              minLength={5}
              maxLength={500}
              autoFocus
              placeholder="Ej. falta material o se requiere una definicion"
              className="mt-2 min-h-20 w-full resize-y rounded-md border border-rose-200 bg-white p-2.5 text-sm text-stone-900 outline-none focus:border-rose-400"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={block} className="btn h-9 bg-rose-700 text-xs text-white hover:bg-rose-800">
              <PauseCircle className="size-3.5" />
              {pending ? "Deteniendo..." : "Confirmar detencion"}
            </button>
            <button type="button" disabled={pending} onClick={() => setShowBlockForm(false)} className="btn btn-secondary h-9 text-xs">
              <X className="size-3.5" />
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(status === "pending" || status === "blocked") ? (
          <button type="button" disabled={pending} onClick={() => move("active")} className="btn btn-secondary h-9 text-xs">
            <Play className="size-3.5" />
            {pending ? "Guardando..." : status === "blocked" ? "Reanudar proceso" : "Empezar"}
          </button>
        ) : null}
        {status === "active" ? (
          <>
            <button type="button" disabled={pending} onClick={() => move("done")} className="btn h-9 border border-emerald-200 bg-emerald-50 text-xs text-emerald-800 hover:bg-emerald-100">
              <Check className="size-3.5" />
              {pending ? "Guardando..." : "Terminar"}
            </button>
            {!showBlockForm ? (
              <button type="button" disabled={pending} onClick={() => setShowBlockForm(true)} className="btn h-9 border border-rose-200 bg-rose-50 text-xs text-rose-800 hover:bg-rose-100">
                <AlertTriangle className="size-3.5" />
                Detener proceso
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      {feedback ? (
        <p role="status" className={`text-xs font-medium ${feedback.tone === "success" ? "text-emerald-700" : "text-rose-700"}`}>
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
