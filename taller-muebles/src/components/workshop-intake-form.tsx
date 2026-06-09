"use client";

import { CheckCircle2, ClipboardPlus, XCircle } from "lucide-react";
import { useActionState, useRef } from "react";
import { createWorkshopOrder, type WorkshopOrderState } from "@/app/taller/actions";
import type { Order } from "@/lib/types";
import { SubmitButton } from "./submit-button";

const initialState: WorkshopOrderState = { status: "idle", message: "" };
const inputClass = "h-11 w-full rounded-xl border border-stone-200 bg-stone-50/30 px-3.5 text-sm text-stone-900 outline-none transition-all duration-150 focus:border-[#9E7A5A] focus:bg-white focus:ring-4 focus:ring-[#9E7A5A]/10";

export function WorkshopIntakeForm({ defaultPriority }: { defaultPriority: Order["priority"] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(async (_state: WorkshopOrderState, formData: FormData) => {
    const result = await createWorkshopOrder(_state, formData);
    if (result.status === "success") formRef.current?.reset();
    return result;
  }, initialState);

  return (
    <form ref={formRef} action={action} className="rounded-2xl border border-stone-200/60 bg-white p-5 shadow-sm shadow-stone-100/50 flex flex-col gap-4">
      <div className="flex items-center gap-3.5 select-none">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#4E3F35] text-white shadow-sm">
          <ClipboardPlus className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-serif font-medium text-stone-900 leading-tight">Ingresar producto</h2>
          <p className="text-xs text-stone-400 font-medium mt-0.5">
            Crea un trabajo operativo en la primera etapa.
          </p>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Tienda">
          <select name="store" defaultValue="LH" className={inputClass}>
            <option value="LH">Leather House</option>
            <option value="LR">La Reina</option>
          </select>
        </Field>
        <Field label="Prioridad">
          <select name="priority" defaultValue={defaultPriority} className={inputClass}>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
            <option value="critical">Crítica</option>
          </select>
        </Field>
        <Field label="Producto" className="sm:col-span-2">
          <input name="productName" required placeholder="Ej. Sofá 3 cuerpos, respaldo alto" className={inputClass} />
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
            className="min-h-24 w-full resize-none rounded-xl border border-stone-200 bg-stone-50/30 p-3.5 text-sm text-stone-900 outline-none transition-all duration-150 focus:border-[#9E7A5A] focus:bg-white focus:ring-4 focus:ring-[#9E7A5A]/10"
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
        <ActionFeedback state={state} />
        <SubmitButton pendingLabel="Ingresando..." className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 text-xs font-bold uppercase tracking-widest text-white hover:bg-stone-900 active:scale-[0.99] disabled:opacity-50 transition duration-150 shrink-0">
          <ClipboardPlus className="size-4" />
          Ingresar a taller
        </SubmitButton>
      </div>
    </form>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`grid gap-1.5 text-xs font-semibold text-stone-600 tracking-wide ${className ?? ""}`}>
      {label}
      {children}
    </label>
  );
}

function ActionFeedback({ state }: { state: WorkshopOrderState }) {
  if (!state.message) return <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest leading-none select-none">Código automático</p>;
  const ok = state.status === "success";
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <p role="status" className={`inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold select-none ${ok ? "text-emerald-700" : "text-rose-700"}`}>
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0">{state.message}</span>
    </p>
  );
}
