"use client";

import { Trash2 } from "lucide-react";
import { removeStockItem } from "@/app/admin/stock/actions";
import { ConfirmSubmitButton } from "./confirm-submit-button";

export function DeactivateStockButton({ itemId, itemName }: { itemId: string; itemName: string }) {
  return (
    <form action={removeStockItem}>
      <input type="hidden" name="stockItemId" value={itemId} />
      <ConfirmSubmitButton
        title="Desactivar material"
        description={`${itemName} dejará de estar disponible para nuevos movimientos. Sus movimientos históricos se conservarán.`}
        confirmLabel="Desactivar"
        pendingLabel="..."
        triggerTitle={`Desactivar ${itemName}`}
        triggerClassName="inline-flex size-8 items-center justify-center rounded-md border border-rose-200 text-rose-700 transition hover:bg-rose-50 disabled:opacity-40"
        trigger={<Trash2 className="size-4" />}
      />
    </form>
  );
}
