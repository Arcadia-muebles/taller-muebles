"use client";

import { CheckCircle2, Plus, XCircle } from "lucide-react";
import { useActionState, useRef } from "react";
import { createStockItem, type StockActionResult } from "@/app/admin/stock/actions";
import { SubmitButton } from "./submit-button";

const initialState: StockActionResult = { ok: false, message: "" };
const inputClass = "control";

export function StockCreateForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(async (_state: StockActionResult, formData: FormData) => {
    const result = await createStockItem(formData);
    if (result.ok) formRef.current?.reset();
    return result;
  }, initialState);

  return (
    <form ref={formRef} id="nuevo-material" action={action} className="panel-pad mt-5">
      <h2 className="panel-title">Registrar material</h2>
      <p className="panel-description">
        Las cantidades disponible y mínima se registran usando la misma unidad de medida.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-6">
        <Field label="Material" className="md:col-span-2">
          <input name="name" required placeholder="Ej. Cuero negro" className={inputClass} />
        </Field>
        <Field label="Categoria">
          <input name="category" required placeholder="Ej. Cuero" className={inputClass} />
        </Field>
        <Field label="Unidad de medida">
          <select name="unit" required defaultValue="unidad" className={inputClass}>
            <option value="unidad">Unidad</option>
            <option value="metro">Metro</option>
            <option value="m2">Metro cuadrado</option>
            <option value="kg">Kilogramo</option>
            <option value="litro">Litro</option>
            <option value="plancha">Plancha</option>
            <option value="rollo">Rollo</option>
          </select>
        </Field>
        <Field label="Cantidad disponible">
          <input name="available" required type="number" min="0" step="1" placeholder="0" className={inputClass} />
        </Field>
        <Field label="Alerta bajo">
          <input name="minimum" required type="number" min="0" step="1" placeholder="0" className={inputClass} />
        </Field>
        <Field label="Ubicación">
          <select name="store" defaultValue="general" className={inputClass}>
            <option value="general">General</option>
            <option value="LH">LH</option>
            <option value="LR">LR</option>
          </select>
        </Field>
        <div className="flex flex-col justify-end gap-2 md:col-span-5">
          <ActionFeedback state={state} />
        </div>
        <div className="flex items-end">
          <SubmitButton pendingLabel="Agregando..." className="btn btn-primary w-full">
            <Plus className="size-4" />
            Agregar
          </SubmitButton>
        </div>
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

function ActionFeedback({ state }: { state: StockActionResult }) {
  if (!state.message) {
    return <p className="text-xs text-stone-400">El material quedará disponible para movimientos y alertas de stock.</p>;
  }
  const Icon = state.ok ? CheckCircle2 : XCircle;
  return (
    <p className={`inline-flex items-center gap-1.5 text-xs font-medium ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>
      <Icon className="size-3.5" />
      {state.message}
    </p>
  );
}
