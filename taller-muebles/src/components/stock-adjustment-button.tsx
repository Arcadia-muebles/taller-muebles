"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useActionState, useState } from "react";
import { adjustStockItem, type StockActionResult } from "@/app/admin/stock/actions";
import type { StockItem } from "@/lib/types";
import { SubmitButton } from "./submit-button";

export function StockAdjustmentButton({ item }: { item: StockItem }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async (_state: StockActionResult, formData: FormData) => {
    const result = await adjustStockItem(formData);
    if (result.ok) setOpen(false);
    return result;
  }, { ok: false, message: "" });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary h-8 px-2.5 text-xs">
        <SlidersHorizontal className="size-3.5" />
        Movimiento
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-stone-950/45 p-4 backdrop-blur-sm">
          <form action={action} role="dialog" aria-modal="true" aria-labelledby={`stock-movement-${item.id}`} className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-5 shadow-2xl">
            <input type="hidden" name="materialId" value={item.id} />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">Movimiento de stock</p>
                <h3 id={`stock-movement-${item.id}`} className="mt-2 text-xl font-semibold">{item.name}</h3>
                <p className="mt-1 text-sm text-stone-500">Disponible: {item.available} {item.unit}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="grid size-9 place-items-center rounded-md border border-stone-200 text-stone-500">
                <X className="size-4" />
              </button>
            </div>
            <label className="mt-5 block text-sm font-medium text-stone-700">
              Tipo de movimiento
              <select name="type" defaultValue="in" className="control-lg mt-2">
                <option value="in">Entrada de material</option>
                <option value="out">Salida o consumo</option>
                <option value="adjustment">Ajuste de inventario</option>
              </select>
            </label>
            <label className="mt-4 block text-sm font-medium text-stone-700">
              Cantidad
              <input name="quantity" required type="number" min="0.01" step="0.01" className="control-lg mt-2" />
            </label>
            <label className="mt-4 block text-sm font-medium text-stone-700">
              Motivo o referencia
              <textarea name="notes" required minLength={3} placeholder="Ej. Compra proveedor / consumo orden LH-204" className="textarea-control mt-2 min-h-24" />
            </label>
            {state.message && !state.ok ? <p role="alert" className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{state.message}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary px-4">Cancelar</button>
              <SubmitButton pendingLabel="Registrando..." className="btn btn-primary px-4">Registrar movimiento</SubmitButton>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
