"use client";

import { CheckCircle2, Ban, Pencil } from "lucide-react";
import Link from "next/link";
import { cancelOrder, closeOrder } from "@/app/admin/orders/actions";
import { ConfirmSubmitButton } from "./confirm-submit-button";

export function OrderActions({ orderId, canClose }: { orderId: string; canClose: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/admin/orders/${orderId}/edit`} className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50">
        <Pencil className="size-4" />
        Editar
      </Link>
      <form action={cancelOrder}>
        <input type="hidden" name="orderId" value={orderId} />
        <ConfirmSubmitButton
          title="Cancelar orden"
          description="La orden saldrá de la vista activa y quedará disponible en historial para trazabilidad."
          confirmLabel="Cancelar orden"
          pendingLabel="Cancelando..."
          triggerClassName="inline-flex h-10 items-center gap-2 rounded-md border border-rose-200 bg-white px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
          trigger={<><Ban className="size-4" />Cancelar</>}
        />
      </form>
      <form action={closeOrder}>
        <input type="hidden" name="orderId" value={orderId} />
        <ConfirmSubmitButton
          title="Cerrar orden"
          description="Todas las etapas quedarán marcadas como terminadas y la orden pasará al historial operacional."
          confirmLabel="Cerrar orden"
          pendingLabel="Cerrando..."
          disabled={!canClose}
          tone="neutral"
          triggerTitle={canClose ? "Cerrar orden" : "Completa la revisión de calidad antes de cerrar"}
          triggerClassName="inline-flex h-10 items-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
          trigger={<><CheckCircle2 className="size-4" />Cerrar orden</>}
        />
      </form>
    </div>
  );
}
