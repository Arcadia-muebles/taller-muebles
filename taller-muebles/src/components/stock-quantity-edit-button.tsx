"use client";

import { Pencil, X } from "lucide-react";
import { useActionState, useState } from "react";
import { updateStockQuantity, type StockActionResult } from "@/app/admin/stock/actions";
import type { StockItem } from "@/lib/types";
import { SubmitButton } from "./submit-button";

export function StockQuantityEditButton({ item }: { item: StockItem }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async (_state: StockActionResult, formData: FormData) => {
    const result = await updateStockQuantity(formData);
    if (result.ok) setOpen(false);
    return result;
  }, { ok: false, message: "" });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Editar cantidad disponible"
        className="inline-flex h-7 items-center gap-1 rounded-md border border-stone-200 bg-white px-2 text-xs font-medium text-stone-700 transition hover:bg-stone-50"
      >
        <Pencil className="size-3" />
        Editar
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-stone-950/45 p-4 backdrop-blur-sm">
          <form action={action} role="dialog" aria-modal="true" aria-labelledby={`stock-quantity-${item.id}`} className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-5 shadow-2xl">
            <input type="hidden" name="materialId" value={item.id} />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">Editar cantidad</p>
                <h3 id={`stock-quantity-${item.id}`} className="mt-2 text-xl font-semibold">{item.name}</h3>
                <p className="mt-1 text-sm text-stone-500">Actual: {item.available} {item.unit}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="grid size-9 place-items-center rounded-md border border-stone-200 text-stone-500">
                <X className="size-4" />
              </button>
            </div>

            <label className="mt-5 block text-sm font-medium text-stone-700">
              Cantidad disponible exacta
              <input name="quantity" required type="number" min="0" step="0.01" defaultValue={item.available} className="control-lg mt-2" />
            </label>
            <label className="mt-4 block text-sm font-medium text-stone-700">
              Motivo o referencia
              <textarea name="notes" placeholder="Ej. Conteo fisico / correccion de carga" className="textarea-control mt-2 min-h-24" />
            </label>
            {state.message && !state.ok ? <p role="alert" className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{state.message}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary px-4">Cancelar</button>
              <SubmitButton pendingLabel="Guardando..." className="btn btn-primary px-4">Guardar cantidad</SubmitButton>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
