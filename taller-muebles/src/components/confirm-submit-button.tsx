"use client";

import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

type ConfirmSubmitButtonProps = {
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  trigger: React.ReactNode;
  triggerClassName: string;
  disabled?: boolean;
  tone?: "danger" | "neutral";
  triggerTitle?: string;
};

export function ConfirmSubmitButton({
  title,
  description,
  confirmLabel,
  pendingLabel,
  trigger,
  triggerClassName,
  disabled = false,
  tone = "danger",
  triggerTitle,
}: ConfirmSubmitButtonProps) {
  const [open, setOpen] = useState(false);
  const { pending } = useFormStatus();
  const danger = tone === "danger";

  return (
    <>
      <button
        type="button"
        disabled={disabled || pending}
        title={triggerTitle}
        onClick={() => setOpen(true)}
        className={triggerClassName}
      >
        {pending ? pendingLabel : trigger}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-stone-950/45 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-submit-title"
            className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-5 shadow-2xl shadow-stone-950/20"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span
                  className={
                    danger
                      ? "grid size-10 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-700"
                      : "grid size-10 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-700"
                  }
                >
                  <AlertTriangle className="size-5" />
                </span>
                <div>
                  <h3 id="confirm-submit-title" className="text-lg font-semibold text-stone-950">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar confirmación"
                className="grid size-9 shrink-0 place-items-center rounded-md border border-stone-200 bg-white text-stone-500 transition hover:bg-stone-50 hover:text-stone-950"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 rounded-md border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={pending}
                className={
                  danger
                    ? "h-10 rounded-md bg-rose-700 px-4 text-sm font-medium text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                    : "h-10 rounded-md bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                }
              >
                {pending ? pendingLabel : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
