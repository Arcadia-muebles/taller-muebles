"use client";

import { MessageSquare, X } from "lucide-react";
import { useActionState, useId, useState } from "react";
import {
  saveProductionStepComment,
  type CollaborationActionResult,
} from "@/app/admin/orders/collaboration-actions";
import { SubmitButton } from "./submit-button";

const initialState: CollaborationActionResult = { ok: false, message: "" };

export function StepCommentButton({
  orderId,
  stepKey,
  stepLabel,
  initialComment,
}: {
  orderId: string;
  stepKey: string;
  stepLabel: string;
  initialComment?: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const [state, action] = useActionState(
    async (_state: CollaborationActionResult, formData: FormData) => {
      const result = await saveProductionStepComment(formData);
      if (result.ok) setOpen(false);
      return result;
    },
    initialState,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-8 place-items-center rounded-md text-stone-500 transition hover:bg-white hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-500"
        aria-label={`${initialComment ? "Editar" : "Agregar"} comentario en ${stepLabel}`}
        title={`${initialComment ? "Editar" : "Agregar"} comentario`}
      >
        <MessageSquare className="size-4" strokeWidth={1.8} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-stone-950/25 p-4" role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-5 shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-500">Comentario de etapa</p>
                <h2 id={titleId} className="mt-1 text-base font-semibold text-stone-950">{stepLabel}</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-md text-stone-500 hover:bg-stone-100" aria-label="Cerrar">
                <X className="size-4" />
              </button>
            </div>

            <form action={action} className="mt-4">
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="stepKey" value={stepKey} />
              <label className="text-sm font-medium text-stone-700" htmlFor={`${titleId}-body`}>Comentario</label>
              <textarea
                id={`${titleId}-body`}
                name="body"
                required
                autoFocus
                minLength={2}
                maxLength={1000}
                defaultValue={initialComment}
                placeholder="Escribe una indicación para esta etapa..."
                className="mt-2 min-h-28 w-full resize-y rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
              />
              {!state.ok && state.message ? <p className="mt-2 text-xs font-medium text-rose-700">{state.message}</p> : null}
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-md px-3 text-sm font-medium text-stone-600 hover:bg-stone-100">Cancelar</button>
                <SubmitButton pendingLabel="Guardando..." className="h-9 rounded-md bg-stone-950 px-3 text-sm font-medium text-white disabled:opacity-50">
                  Guardar
                </SubmitButton>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
