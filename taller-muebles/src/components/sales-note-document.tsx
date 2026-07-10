"use client";

import Link from "next/link";
import { Check, Pencil, Wrench, X } from "lucide-react";
import { useActionState, useState } from "react";
import { updateOrder } from "@/app/admin/orders/actions";
import { AddPaymentForm } from "@/components/add-payment-form";
import { PaymentHistory } from "@/components/payment-history";
import type { Order } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type Props = { code: string; orders: Order[]; canEdit: boolean };

export function SalesNoteDocument({ code, orders, canEdit }: Props) {
  const document = orders[0];
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateOrder.bind(null, document?.id ?? ""), { status: "idle" as const, message: "" });
  if (!document) return null;

  const formId = `sales-note-${document.id}`;
  const subtotal = numberOr(document.subtotal, orders.reduce((sum, order) => sum + lineTotal(order), 0));
  const discount = numberOr(document.discount, 0);
  const total = numberOr(document.total, Math.max(subtotal - discount, 0));
  const paid = numberOr(document.paidAmount, 0);
  const balance = numberOr(document.balance, Math.max(total - paid, 0));
  const progress = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const payments = document.payments ?? (paid ? [{ id: "initial", paidAt: document.entryDate, amount: paid, method: document.paymentMethod || "Abono inicial" }] : []);

  return <article className={`overflow-hidden rounded-lg border bg-white shadow-sm ${editing ? "border-amber-300 ring-1 ring-amber-200" : "border-stone-200"}`}>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-4 py-3 md:px-7">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{editing ? "Editando nota de venta" : "Nota de venta emitida"}</p>
      <div className="flex flex-wrap gap-2">
        {!editing ? <><Link href={`/admin/documents/${encodeURIComponent(code)}`} className="btn btn-secondary h-9 text-xs">Ver detalle</Link><Link href={`/admin/orders/${document.id}`} className="btn btn-secondary h-9 text-xs"><Wrench className="size-3.5" />Producción</Link></> : null}
        {canEdit && !editing ? <button type="button" onClick={() => setEditing(true)} className="btn h-9 text-xs"><Pencil className="size-3.5" />Editar</button> : null}
        {editing ? <><button type="button" onClick={() => setEditing(false)} className="btn btn-secondary h-9 text-xs"><X className="size-3.5" />Cancelar</button><button type="submit" form={formId} disabled={pending} className="btn h-9 text-xs"><Check className="size-3.5" />{pending ? "Guardando" : "Guardar"}</button></> : null}
      </div>
    </header>

    <form id={formId} action={action} onSubmit={() => setEditing(false)}>
      <HiddenFields order={document} code={code} subtotal={subtotal} discount={discount} paid={paid} />
    </form>
    {state.status === "error" ? <p className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700 md:px-7">{state.message}</p> : null}

    <div className="grid gap-6 px-4 py-6 md:grid-cols-[150px_1fr_170px] md:px-7">
      <div className="flex h-24 w-28 items-center justify-center rounded-md border border-stone-200 text-center"><div><p className="text-xs font-bold tracking-[0.18em]">LA REINA</p><p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">Muebles en cuero</p></div></div>
      <div className="text-center"><h3 className="text-base font-bold uppercase">Fabricación y venta de muebles</h3><div className="mt-2 space-y-1 text-xs leading-5 text-stone-600"><p>Carmen #2001 - Santiago Centro</p><p>Fono: 22 555 3795 - 22 556 5988</p><p>www.muebleslareina.cl</p><p>lareina@mueblesencuero.cl</p></div></div>
      <div className="md:text-right"><div className="inline-flex rounded-md border border-stone-200 px-3 py-2 text-sm font-bold uppercase">Nota de venta</div><p className="mt-3 text-2xl font-bold">{code}</p><div className="mt-2 text-sm font-medium text-stone-700">Fecha: <Editable editing={editing} form={formId} name="entryDate" value={document.entryDate} type="date" className="w-36 text-right">{formatDate(document.entryDate)}</Editable></div></div>
    </div>

    <div className="grid gap-x-8 gap-y-3 border-y border-stone-200 bg-stone-50/70 px-4 py-4 text-sm md:grid-cols-2 md:px-7">
      <Field label="Nombre" value={document.client} strong editing={editing} form={formId} name="clientName" />
      <Field label="Comuna" value={document.customerCommune} editing={editing} form={formId} name="customerCommune" />
      <Field label="Dirección" value={document.customerAddress} editing={editing} form={formId} name="customerAddress" />
      <Field label="RUT" value={document.customerRut} editing={editing} form={formId} name="customerRut" />
      <Field label="Correo" value={document.customerEmail} editing={editing} form={formId} name="customerEmail" type="email" />
      <Field label="Teléfono" value={document.customerPhone} editing={editing} form={formId} name="customerPhone" />
    </div>

    <div className="overflow-x-auto"><table className="w-full min-w-[720px] border-collapse"><thead><tr className="border-b border-stone-200 bg-stone-50"><Th>Cant.</Th><Th>Descripción del producto</Th><Th right>Valor unitario</Th><Th right>Subtotal</Th></tr></thead><tbody>{orders.map((order) => {
      const editable = editing && order.id === document.id;
      return <tr key={order.id} className="border-b border-stone-200 last:border-b-0"><td className="px-4 py-4 text-sm"><Editable editing={editable} form={formId} name="quantity" value={String(order.quantity ?? 1)} type="number" className="w-14">{formatQuantity(order.quantity)}</Editable></td><td className="px-4 py-4"><div className="text-sm font-semibold"><Editable editing={editable} form={formId} name="productName" value={order.product} className="w-full">{order.product}</Editable></div><div className="mt-1 text-xs text-stone-500"><Editable editing={editable} form={formId} name="color" value={order.color} className="w-full">{order.color || "Color por definir"}</Editable></div></td><td className="px-4 py-4 text-right text-sm"><Editable editing={editable} form={formId} name="unitPrice" value={String(order.unitPrice ?? 0)} type="number" className="w-28 text-right">{formatCurrency(order.unitPrice)}</Editable></td><td className="px-4 py-4 text-right text-sm font-bold">{formatCurrency(lineTotal(order))}</td></tr>;
    })}</tbody></table></div>

    <div className="grid gap-5 border-b border-stone-200 px-4 py-4 md:grid-cols-[1fr_260px] md:px-7"><div className="grid content-start gap-2 text-sm"><p className="label">Entrega</p><div className="font-semibold"><Editable editing={editing} form={formId} name="deliveryDate" value={document.deliveryDate} type="date">{formatDate(document.deliveryDate)}</Editable></div></div><div className="overflow-hidden rounded-lg border border-stone-950"><div className="bg-stone-950 px-4 py-2 text-center text-xs font-bold uppercase tracking-[0.14em] text-white">Total</div><div className="divide-y divide-stone-200 text-sm"><Summary label="Subtotal" value={formatCurrency(subtotal)} /><Summary label="Descuento" value={formatCurrency(discount)} /><Summary label="Total" value={formatCurrency(total)} strong edit={editing ? <InlineInput form={formId} name="total" value={String(total)} type="number" className="w-28 text-right" /> : undefined} /></div></div></div>

    <div className="grid gap-4 border-b border-stone-200 px-4 py-4 md:grid-cols-2 md:px-7"><div className="rounded-lg border border-stone-200 bg-stone-50 p-4"><p className="label">Abono</p><p className="mt-2 text-xl font-bold">{formatCurrency(paid)}</p><PaymentHistory orderId={document.id} payments={payments} canEdit={canEdit && !editing} />{canEdit && balance > 0 && !editing ? <AddPaymentForm orderId={document.id} /> : null}</div><div className="rounded-lg border border-stone-200 bg-stone-50 p-4"><p className="label">Saldo</p><p className="mt-2 text-xl font-bold">{formatCurrency(balance)}</p><p className="mt-2 text-xs text-stone-500">Saldo pendiente calculado desde el total y los abonos registrados.</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-200"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs font-semibold text-emerald-700">{progress}% del total pagado · Pendiente {formatCurrency(balance)}</p></div></div>

    <div className="border-b border-stone-200 px-4 py-4 text-center md:px-7"><p className="label">Condiciones de entrega</p>{editing ? <textarea form={formId} name="deliveryTerms" defaultValue={document.deliveryTerms ?? ""} className="mt-2 min-h-16 w-full resize-y rounded border border-stone-200 bg-white p-2 text-center text-sm outline-none focus:border-stone-500" /> : <p className="mt-2 text-sm leading-6 text-stone-700">{document.deliveryTerms?.trim() || "Sin condiciones registradas."}</p>}</div>
    <div className="grid gap-5 px-4 py-5 md:grid-cols-[1fr_220px] md:px-7"><Field label="Vendedor" value={document.sellerName} strong editing={editing} form={formId} name="sellerName" /><div className="self-end text-center"><div className="border-b border-stone-950 pt-10" /><p className="mt-2 text-xs text-stone-500">Firma</p></div></div>
  </article>;
}

function HiddenFields({ order, code, subtotal, discount, paid }: { order: Order; code: string; subtotal: number; discount: number; paid: number }) {
  return <><input type="hidden" name="store" value={order.store} /><input type="hidden" name="documentType" value={order.documentType} /><input type="hidden" name="documentStatus" value={order.documentStatus} /><input type="hidden" name="salesNoteNumber" value={code} /><input type="hidden" name="groupCode" value={order.groupCode} /><input type="hidden" name="material" value={order.material} /><input type="hidden" name="subtotal" value={subtotal} /><input type="hidden" name="discount" value={discount} /><input type="hidden" name="paidAmount" value={paid} /><input type="hidden" name="paymentMethod" value={order.paymentMethod ?? ""} /><input type="hidden" name="assignedTo" value={order.assignedTo} /><input type="hidden" name="customerContact" value={order.customerContact ?? ""} /><input type="hidden" name="observations" value={order.observations} /></>;
}

function Editable({ editing, form, name, value, type = "text", className = "", children }: { editing: boolean; form: string; name: string; value: string; type?: string; className?: string; children: React.ReactNode }) { return editing ? <InlineInput form={form} name={name} value={value} type={type} className={className} /> : children; }
function InlineInput({ form, name, value, type = "text", className = "" }: { form: string; name: string; value: string; type?: string; className?: string }) { return <input form={form} name={name} defaultValue={value} type={type} required className={`rounded border border-amber-300 bg-amber-50/50 px-1.5 py-1 outline-none focus:border-amber-500 focus:bg-white ${className}`} />; }
function Field({ label, value, strong, editing, form, name, type }: { label: string; value?: string; strong?: boolean; editing?: boolean; form?: string; name?: string; type?: string }) { return <div><p className="label">{label}</p>{editing && form && name ? <InlineInput form={form} name={name} value={value ?? ""} type={type} className="mt-1 w-full" /> : <p className={`mt-1 border-b border-stone-200 pb-1 ${strong ? "font-semibold" : "text-stone-700"}`}>{value?.trim() || "Sin registrar"}</p>}</div>; }
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) { return <th className={`px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400 ${right ? "text-right" : "text-left"}`}>{children}</th>; }
function Summary({ label, value, strong, edit }: { label: string; value: string; strong?: boolean; edit?: React.ReactNode }) { return <div className={`flex items-center justify-between gap-3 px-4 py-2 ${strong ? "font-bold" : "text-stone-600"}`}><span>{label}</span>{edit ?? <span>{value}</span>}</div>; }
function lineTotal(order: Order) { return numberOr(order.quantity, 1) * numberOr(order.unitPrice, 0); }
function numberOr(value: number | undefined, fallback: number) { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
function formatQuantity(value?: number) { return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(numberOr(value, 1)); }
function formatCurrency(value?: number) { return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(numberOr(value, 0)); }
