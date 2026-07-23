"use client";

import { Plus } from "lucide-react";
import { useActionState } from "react";
import { addDocumentPayment } from "@/app/admin/documents/actions";
import { ClpAmountInput } from "@/components/clp-amount-input";

export function AddPaymentForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(async (_: { status?: string; message?: string } | null, formData: FormData) => addDocumentPayment(formData), null);
  return <form action={action} className="mt-3 grid gap-2 sm:grid-cols-[130px_1fr_1fr_auto]">
    <input type="hidden" name="orderId" value={orderId} />
    <input name="paidAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="control bg-white" />
    <ClpAmountInput name="amount" className="control bg-white" />
    <input name="method" required placeholder="Medio de pago" className="control bg-white" />
    <button disabled={pending} className="btn h-10"><Plus className="size-4" />{pending ? "Guardando" : "Agregar pago"}</button>
    {state?.message ? <p className={`text-xs font-medium sm:col-span-4 ${state.status === "error" ? "text-rose-700" : "text-emerald-700"}`}>{state.message}</p> : null}
  </form>;
}
