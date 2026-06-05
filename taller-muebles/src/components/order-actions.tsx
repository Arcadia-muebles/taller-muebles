"use client";

import { CheckCircle2, Ban, Pencil } from "lucide-react";
import Link from "next/link";
import { cancelOrder, closeOrder } from "@/app/admin/orders/actions";
import { SubmitButton } from "./submit-button";

export function OrderActions({ orderId, canClose }: { orderId: string; canClose: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/admin/orders/${orderId}/edit`} className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50">
        <Pencil className="size-4" />
        Editar
      </Link>
      <form
        action={cancelOrder}
        onSubmit={(event) => {
          if (!window.confirm("¿Cancelar esta orden? Quedará disponible en el historial.")) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="orderId" value={orderId} />
        <SubmitButton pendingLabel="Cancelando..." className="inline-flex h-10 items-center gap-2 rounded-md border border-rose-200 bg-white px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50">
          <Ban className="size-4" />
          Cancelar
        </SubmitButton>
      </form>
      <form
        action={closeOrder}
        onSubmit={(event) => {
          if (!window.confirm("¿Cerrar la orden y marcar todas sus etapas como terminadas?")) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="orderId" value={orderId} />
        <SubmitButton disabled={!canClose} title={canClose ? "Cerrar orden" : "Completa la revisión de calidad antes de cerrar"} pendingLabel="Cerrando..." className="inline-flex h-10 items-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40">
          <CheckCircle2 className="size-4" />
          Cerrar orden
        </SubmitButton>
      </form>
    </div>
  );
}
