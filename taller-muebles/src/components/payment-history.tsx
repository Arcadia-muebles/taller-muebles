"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteDocumentPayment, updateDocumentPayment } from "@/app/admin/documents/actions";
import { ClpAmountInput } from "@/components/clp-amount-input";
import type { OrderPayment } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function PaymentHistory({ orderId, payments, canEdit }: { orderId: string; payments: OrderPayment[]; canEdit: boolean }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(paymentId: string, formData: FormData) {
    setFeedback(null);
    startTransition(async () => {
      const result = await updateDocumentPayment({ orderId, paymentId, paidAt: String(formData.get("paidAt") ?? ""), amount: Number(formData.get("amount") ?? 0), method: String(formData.get("method") ?? ""), note: String(formData.get("note") ?? "") || undefined });
      setFeedback(result.message);
      if (result.status === "success") { setEditingId(null); router.refresh(); }
    });
  }

  function remove(payment: OrderPayment) {
    if (!window.confirm(`¿Eliminar el abono de ${formatCurrency(payment.amount)}?`)) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await deleteDocumentPayment({ orderId, paymentId: payment.id });
      setFeedback(result.message);
      if (result.status === "success") router.refresh();
    });
  }

  return <div className="mt-3 divide-y divide-stone-200 border-t border-stone-200">
    {payments.map((payment) => editingId === payment.id ? (
      <form key={payment.id} action={(data) => save(payment.id, data)} className="grid gap-2 py-2 sm:grid-cols-[130px_110px_1fr_auto]">
        <input name="paidAt" type="date" required defaultValue={payment.paidAt} className="control h-9 bg-white text-xs" />
        <ClpAmountInput name="amount" defaultValue={payment.amount} className="control h-9 bg-white text-xs" />
        <input name="method" required defaultValue={payment.method} className="control h-9 bg-white text-xs" />
        <div className="flex gap-1"><button disabled={pending} className="grid size-9 place-items-center rounded border border-emerald-200 bg-emerald-50 text-emerald-700" title="Guardar abono"><Check className="size-4" /></button><button type="button" onClick={() => setEditingId(null)} className="grid size-9 place-items-center rounded border border-stone-200 bg-white text-stone-600" title="Cancelar"><X className="size-4" /></button></div>
      </form>
    ) : (
      <div key={payment.id} className="group/payment grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2 text-xs">
        <span className="text-stone-600">{formatDate(payment.paidAt)} · {payment.method}</span>
        <span className="font-semibold text-stone-950">{formatCurrency(payment.amount)}</span>
        {canEdit ? <div className="flex opacity-60 transition group-hover/payment:opacity-100"><button type="button" onClick={() => setEditingId(payment.id)} className="grid size-7 place-items-center rounded text-stone-500 hover:bg-white hover:text-stone-950" title="Editar abono"><Pencil className="size-3.5" /></button><button type="button" disabled={pending} onClick={() => remove(payment)} className="grid size-7 place-items-center rounded text-stone-500 hover:bg-rose-50 hover:text-rose-700" title="Eliminar abono"><Trash2 className="size-3.5" /></button></div> : null}
      </div>
    ))}
    {feedback ? <p className="py-2 text-xs font-medium text-stone-600">{feedback}</p> : null}
  </div>;
}

function formatCurrency(value: number) { return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value); }
