"use client";

import { Check, Play } from "lucide-react";
import { useTransition } from "react";
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

  function move(nextStatus: StepStatus) {
    startTransition(async () => {
      await updateProductionStep({ orderId, stepKey, status: nextStatus });
    });
  }

  if (status === "done") return null;

  return (
    <div className="flex flex-wrap gap-2">
      {(status === "pending" || status === "blocked") ? (
        <button type="button" disabled={pending} onClick={() => move("active")} className="btn btn-secondary h-8 text-xs">
          <Play className="size-3.5" />
          Empezar
        </button>
      ) : null}
      {status === "active" ? (
        <button type="button" disabled={pending} onClick={() => move("done")} className="btn h-8 border border-emerald-200 bg-emerald-50 text-xs text-emerald-800 hover:bg-emerald-100">
          <Check className="size-3.5" />
          Terminar
        </button>
      ) : null}
    </div>
  );
}
