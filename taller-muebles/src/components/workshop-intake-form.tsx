"use client";

import { CheckCircle2, ClipboardPlus, XCircle } from "lucide-react";
import { useActionState, useRef } from "react";
import { createWorkshopOrder, type WorkshopOrderState } from "@/app/taller/actions";
import { SubmitButton } from "./submit-button";

const initialState: WorkshopOrderState = { status: "idle", message: "" };
const inputClass = "control";

export function WorkshopIntakeForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(async (_state: WorkshopOrderState, formData: FormData) => {
    const result = await createWorkshopOrder(_state, formData);
    if (result.status === "success") formRef.current?.reset();
    return result;
  }, initialState);

  return (
    <form ref={formRef} action={action} className="panel-pad">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-md bg-stone-950 text-white">
          <ClipboardPlus className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 className="panel-title">Ingresar producto</h2>
          <p className="panel-description leading-5">
            Crea un trabajo operativo y lo deja listo en la primera etapa configurada.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Tienda">
          <select name="store" defaultValue="LH" className={inputClass}>
            <option value="LH">Leather House</option>
            <option value="LR">La Reina</option>
          </select>
        </Field>
        <Field label="Producto" className="sm:col-span-2">
          <input name="productName" required placeholder="Ej. Sofa 3 cuerpos, respaldo alto" className={inputClass} />
        </Field>
        <Field label="Cliente">
          <input name="clientName" placeholder="Trabajo interno si queda vacío" className={inputClass} />
        </Field>
        <Field label="Entrega">
          <input name="deliveryDate" required type="date" className={inputClass} />
        </Field>
        <Field label="Material">
          <input name="material" placeholder="Por definir" className={inputClass} />
        </Field>
        <Field label="Color">
          <input name="color" placeholder="Por definir" className={inputClass} />
        </Field>
        <Field label="Observaciones" className="sm:col-span-2">
          <textarea
            name="observations"
            maxLength={500}
            placeholder="Medidas, piezas, faltantes, instrucciones o cambios."
            className="textarea-control min-h-24"
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ActionFeedback state={state} />
        <SubmitButton pendingLabel="Ingresando..." className="btn btn-primary px-4">
          <ClipboardPlus className="size-4" />
          Ingresar a taller
        </SubmitButton>
      </div>
    </form>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`grid gap-1.5 text-xs font-medium text-stone-600 ${className ?? ""}`}>
      {label}
      {children}
    </label>
  );
}

function ActionFeedback({ state }: { state: WorkshopOrderState }) {
  if (!state.message) return <p className="text-xs text-stone-400">El código se genera automáticamente.</p>;
  const ok = state.status === "success";
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <p role="status" className={`inline-flex min-w-0 items-center gap-1.5 text-xs font-medium ${ok ? "text-emerald-700" : "text-rose-700"}`}>
      <Icon className="size-3.5 shrink-0" />
      <span className="min-w-0">{state.message}</span>
    </p>
  );
}
