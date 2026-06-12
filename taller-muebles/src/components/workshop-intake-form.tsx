"use client";

import { CheckCircle2, ClipboardPlus, Boxes, XCircle } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { createWorkshopOrder, type WorkshopOrderState } from "@/app/taller/actions";
import type { Order } from "@/lib/types";
import { SubmitButton } from "./submit-button";

const initialState: WorkshopOrderState = { status: "idle", message: "" };
const inputClass = "control";

export function WorkshopIntakeForm({ defaultPriority }: { defaultPriority: Order["priority"] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [width, setWidth] = useState(0);
  const [depth, setDepth] = useState(0);
  const [height, setHeight] = useState(0);
  const [material, setMaterial] = useState("");

  const w = Number(width) || 0;
  const d = Number(depth) || 0;
  const h = Number(height) || 0;
  const matName = material || "";

  const leatherQty = w && d && h ? Math.round(((w * d * 3 + w * h * 2 + d * h * 2) / 10000) * 10) / 10 : 0;
  const woodQty = w && d && h ? Math.max(2, Math.round((w * 2 + d * 4 + h * 4) / 100)) : 0;
  const foamQty = w && d && h ? Math.max(1, Math.round((w * d * 2) / 10000)) : 0;

  const [state, action] = useActionState(async (_state: WorkshopOrderState, formData: FormData) => {
    const result = await createWorkshopOrder(_state, formData);
    if (result.status === "success") {
      formRef.current?.reset();
      setWidth(0);
      setDepth(0);
      setHeight(0);
      setMaterial("");
    }
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
        <Field label="Empresa Cliente">
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
          <input name="productName" required placeholder="Ej. Sofa 3 cuerpos, respaldo alto" className={inputClass} />
        </Field>
        <Field label="Cliente Final">
          <input name="clientName" placeholder="Trabajo interno si queda vacio" className={inputClass} />
        </Field>
        <Field label="Entrega">
          <input name="deliveryDate" required type="date" className={inputClass} />
        </Field>
        <Field label="Material">
          <input name="material" placeholder="Por definir" className={inputClass} onChange={(e) => setMaterial(e.target.value)} />
        </Field>
        <Field label="Color">
          <input name="color" placeholder="Por definir" className={inputClass} />
        </Field>
        <Field label="Ancho (cm)">
          <input name="width" required type="number" placeholder="200" className={inputClass} onChange={(e) => setWidth(Number(e.target.value))} />
        </Field>
        <Field label="Profundidad (cm)">
          <input name="depth" required type="number" placeholder="90" className={inputClass} onChange={(e) => setDepth(Number(e.target.value))} />
        </Field>
        <Field label="Alto (cm)">
          <input name="height" required type="number" placeholder="80" className={inputClass} onChange={(e) => setHeight(Number(e.target.value))} />
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

      {w > 0 && d > 0 && h > 0 ? (
        <section className="mt-4 rounded-md border border-amber-200 bg-amber-50/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Boxes className="size-4 text-amber-700" />
            <p className="text-xs font-semibold text-amber-950">Consumo Estimado de Stock</p>
          </div>
          <div className="grid gap-2 grid-cols-3 text-[11px] leading-4 text-stone-600 bg-white p-2 rounded border border-amber-200">
            <div>
              <span className="font-medium">Cuero ({matName || "Riga Honey"}):</span>
              <p className="text-stone-900 font-bold">{leatherQty} m²</p>
            </div>
            <div>
              <span className="font-medium">Madera:</span>
              <p className="text-stone-900 font-bold">{woodQty} tablas</p>
            </div>
            <div>
              <span className="font-medium">Espuma:</span>
              <p className="text-stone-900 font-bold">{foamQty} planchas</p>
            </div>
          </div>
        </section>
      ) : null}

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
