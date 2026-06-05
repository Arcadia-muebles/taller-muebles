"use client";

import { Trash2 } from "lucide-react";
import { removeStockItem } from "@/app/admin/stock/actions";
import { SubmitButton } from "./submit-button";

export function DeactivateStockButton({ itemId, itemName }: { itemId: string; itemName: string }) {
  return (
    <form
      action={removeStockItem}
      onSubmit={(event) => {
        if (!window.confirm(`¿Desactivar ${itemName}? Se conservarán sus movimientos históricos.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="stockItemId" value={itemId} />
      <SubmitButton pendingLabel="..." className="inline-flex size-8 items-center justify-center rounded-md border border-rose-200 text-rose-700 transition hover:bg-rose-50 disabled:opacity-40" title={`Desactivar ${itemName}`}>
        <Trash2 className="size-4" />
      </SubmitButton>
    </form>
  );
}
