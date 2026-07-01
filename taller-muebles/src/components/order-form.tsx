"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  DollarSign,
  Factory,
  FileText,
  PackagePlus,
  Paperclip,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { forwardRef, useActionState, useEffect, useRef, useTransition } from "react";
import { useFieldArray, useForm, useWatch, type Resolver } from "react-hook-form";
import { createOrder, updateOrder, type CreateOrderState } from "@/app/admin/orders/actions";
import type { StoreCode } from "@/lib/types";
import { newOrderSchema, orderSchema, type NewOrderFormValues, type OrderFormValues } from "@/lib/validation/order";

const inputClass = "control-lg bg-white";
const labelClass = "field-label";
const initialState: CreateOrderState = {
  status: "idle",
  message: "",
};

type FormValues = OrderFormValues | NewOrderFormValues;
type FieldErrors = Partial<Record<keyof OrderFormValues, { message?: string }>>;

export function OrderForm({
  orderId,
  initialValues,
  nextCodes = { LH: "LH-001", LR: "LR-001" },
}: {
  orderId?: string;
  initialValues?: OrderFormValues;
  assignees?: string[];
  nextCodes?: Record<StoreCode, string>;
}) {
  const action = orderId ? updateOrder.bind(null, orderId) : createOrder;
  const [state, formAction, actionPending] = useActionState(action, initialState);
  const [formPending, startTransition] = useTransition();
  const lastAutoCode = useRef<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors, submitCount },
  } = useForm<FormValues>({
    resolver: zodResolver(orderId ? orderSchema : newOrderSchema) as Resolver<FormValues>,
    defaultValues: initialValues ?? {
      store: "LR",
      documentType: "sales_note",
      documentStatus: "issued",
      salesNoteNumber: nextCodes.LR,
      isWarranty: false,
      entryDate: new Date().toISOString().slice(0, 10),
      discount: 0,
      paidAmount: 0,
      sellerName: "Rodrigo Bravo G.",
      paymentMethod: "Transferencia",
      deliveryTerms: "El despacho dentro de Santiago no tiene costo. En caso de subir o bajar por escalas el costo sera de $7.000.- por piso.",
      products: [{ productName: "", material: "", color: "", quantity: 1 }],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "products",
  });
  const store = useWatch({ control, name: "store" });
  const documentType = useWatch({ control, name: "documentType" });
  const products = useWatch({ control, name: "products" }) ?? [];
  const quantity = useWatch({ control, name: "quantity" });
  const unitPrice = useWatch({ control, name: "unitPrice" });
  const discountValue = useWatch({ control, name: "discount" });
  const paidAmountValue = useWatch({ control, name: "paidAmount" });
  const entryDateValue = useWatch({ control, name: "entryDate" });
  const deliveryDateValue = useWatch({ control, name: "deliveryDate" });
  const isLeatherHouse = store === "LH";
  const isCommercialDocument = store === "LR";
  const pending = actionPending || formPending;
  const showValidationSummary = submitCount > 0 && Object.keys(errors).length > 0;
  const typedErrors = errors as FieldErrors & {
    products?: Array<{
      productName?: { message?: string };
      material?: { message?: string };
      color?: { message?: string };
      quantity?: { message?: string };
      unitPrice?: { message?: string };
    }>;
  };

  useEffect(() => {
    if (orderId) return;
    const nextCode = nextCodes[store as StoreCode];
    const currentCode = getValues("salesNoteNumber")?.trim();
    if (!nextCode) return;
    if (!currentCode || currentCode === lastAutoCode.current) {
      setValue("salesNoteNumber", nextCode, { shouldDirty: false, shouldValidate: true });
      lastAutoCode.current = nextCode;
    }
  }, [getValues, nextCodes, orderId, setValue, store]);

  useEffect(() => {
    if (store === "LH") {
      setValue("documentType", "production_intake", { shouldDirty: false, shouldValidate: true });
    } else if (documentType === "production_intake") {
      setValue("documentType", "sales_note", { shouldDirty: false, shouldValidate: true });
    }
  }, [documentType, setValue, store]);

  const computedSubtotal = isCommercialDocument
    ? orderId
      ? lineTotal(quantity, unitPrice)
      : products.reduce((sum, product) => sum + lineTotal(product.quantity, product.unitPrice), 0)
    : 0;
  const computedDiscount = Number(discountValue ?? 0) || 0;
  const computedTotal = Math.max(computedSubtotal - computedDiscount, 0);
  const computedPaid = Number(paidAmountValue ?? 0) || 0;
  const computedBalance = Math.max(computedTotal - computedPaid, 0);
  const computedNet = Math.round(computedTotal / 1.19);
  const computedVat = Math.max(computedTotal - computedNet, 0);

  useEffect(() => {
    if (!isCommercialDocument) return;
    setValue("subtotal", computedSubtotal, { shouldDirty: false, shouldValidate: true });
    setValue("total", computedTotal, { shouldDirty: false, shouldValidate: true });
  }, [computedSubtotal, computedTotal, isCommercialDocument, setValue]);

  const submit = handleSubmit((_values, event) => {
    if (!(event?.target instanceof HTMLFormElement)) return;
    const formData = new FormData(event.target);
    if (!orderId) formData.set("productItems", JSON.stringify(products));
    startTransition(() => formAction(formData));
  });

  if (!orderId && state.status === "success") {
    return <OrderSuccessScreen message={state.message} orderId={state.orderId} />;
  }

  if (!orderId) {
    return (
      <form action={formAction} onSubmit={submit} className="space-y-4">
        <input type="hidden" name="productItems" value={JSON.stringify(products)} readOnly />
        <input type="hidden" {...register("subtotal")} value={computedSubtotal} readOnly />
        <input type="hidden" {...register("total")} value={computedTotal} readOnly />
        <input type="hidden" {...register("customerContact")} />

        <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 bg-stone-50 px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                <FileText className="size-4" />
                Vista previa editable - nota de venta
              </div>
              <div className="grid gap-2 sm:grid-cols-[180px_180px_180px]">
                <select {...register("store")} className="control bg-white">
                  <option value="LH">LH - produccion</option>
                  <option value="LR">LR - comercial</option>
                </select>
                {isCommercialDocument ? (
                  <select {...register("documentType")} className="control bg-white">
                    <option value="sales_note">Nota de Venta</option>
                    <option value="quote">Cotizacion</option>
                    <option value="purchase_order">Orden de Compra</option>
                    <option value="warranty">Garantia</option>
                  </select>
                ) : (
                  <input type="hidden" {...register("documentType")} value="production_intake" />
                )}
                <select {...register("documentStatus")} className="control bg-white">
                  <option value="draft">Borrador</option>
                  <option value="issued">Emitido</option>
                  <option value="approved">Aprobado</option>
                  <option value="closed">Cerrado</option>
                  <option value="cancelled">Anulado</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-4 py-6 md:grid-cols-[150px_1fr_170px] md:px-7">
            <div className="flex h-24 w-28 items-center justify-center rounded-md border border-stone-200 text-center">
              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-stone-950">{isLeatherHouse ? "LEATHER HOUSE" : "LA REINA"}</p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                  {isLeatherHouse ? "Produccion" : "Muebles en cuero"}
                </p>
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-base font-bold uppercase tracking-[0.02em] text-stone-950">Fabricacion y venta de muebles</h2>
              <div className="mt-2 space-y-1 text-xs leading-5 text-stone-600">
                <p>Carmen #2001 - Santiago Centro</p>
                <p>Fono: 22 555 3795 - 22 556 5988</p>
                <p>www.muebleslareina.cl</p>
                <p>lareina@mueblesencuero.cl</p>
              </div>
            </div>
            <div className="md:text-right">
              <div className="inline-flex rounded-md border border-stone-200 px-3 py-2 text-sm font-bold uppercase text-stone-950">
                {isLeatherHouse ? "Ingreso taller" : "Nota de venta"}
              </div>
              <input
                {...register("salesNoteNumber")}
                className="mt-3 w-full border-0 border-b border-stone-200 bg-transparent px-0 pb-1 text-left text-2xl font-bold text-stone-950 outline-none focus:border-stone-500 md:text-right"
                placeholder={isLeatherHouse ? "LH-001" : "LR-001"}
              />
              {typedErrors.salesNoteNumber?.message ? <p className="mt-1 text-xs font-medium text-rose-600">{typedErrors.salesNoteNumber.message}</p> : null}
              <label className="mt-2 block text-xs text-stone-500">
                Fecha
                <input {...register("entryDate")} type="date" className="ml-2 border-0 border-b border-stone-200 bg-transparent text-sm font-medium text-stone-950 outline-none focus:border-stone-500" />
              </label>
              {typedErrors.entryDate?.message ? <p className="mt-1 text-xs font-medium text-rose-600">{typedErrors.entryDate.message}</p> : null}
            </div>
          </div>

          <div className="grid gap-x-8 gap-y-3 border-y border-stone-200 bg-stone-50/70 px-4 py-4 md:grid-cols-2 md:px-7">
            <DocumentField label="Nombre" error={typedErrors.clientName?.message}>
              <DocumentInput {...register("clientName")} placeholder="Nombre del cliente" strong />
            </DocumentField>
            <DocumentField label="Comuna" error={typedErrors.customerCommune?.message}>
              <DocumentInput {...register("customerCommune")} placeholder="Comuna" />
            </DocumentField>
            {isCommercialDocument ? (
              <>
                <DocumentField label="Direccion" error={typedErrors.customerAddress?.message}>
                  <DocumentInput {...register("customerAddress")} placeholder="Direccion de despacho o cliente" />
                </DocumentField>
                <DocumentField label="RUT" error={typedErrors.customerRut?.message}>
                  <DocumentInput {...register("customerRut")} placeholder="RUT" />
                </DocumentField>
                <DocumentField label="Correo" error={typedErrors.customerEmail?.message}>
                  <DocumentInput {...register("customerEmail")} type="email" placeholder="correo@cliente.cl" />
                </DocumentField>
                <DocumentField label="Telefono" error={typedErrors.customerPhone?.message}>
                  <DocumentInput {...register("customerPhone")} placeholder="+56 9 ..." />
                </DocumentField>
              </>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th className="w-14 px-4 py-2 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">Cant.</th>
                  <th className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">Descripcion del producto</th>
                  <th className="w-36 px-4 py-2 text-right text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">Valor unitario</th>
                  <th className="w-36 px-4 py-2 text-right text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">Subtotal</th>
                  <th className="w-11 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => {
                  const product = products[index] ?? {};
                  const productTotal = lineTotal(product.quantity, product.unitPrice);
                  return (
                    <tr key={field.id} className="border-b border-stone-200 last:border-b-0">
                      <td className="px-4 py-4 align-top">
                        <input
                          {...register(`products.${index}.quantity`)}
                          type="number"
                          min="1"
                          className="h-9 w-12 rounded-md border border-transparent bg-transparent text-center text-sm text-stone-950 outline-none transition focus:border-stone-300 focus:bg-white"
                        />
                        {typedErrors.products?.[index]?.quantity?.message ? (
                          <p className="mt-1 text-xs font-medium text-rose-600">{typedErrors.products[index]?.quantity?.message}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <input
                          {...register(`products.${index}.productName`)}
                          className="w-full border-0 bg-transparent text-sm font-semibold text-stone-950 outline-none placeholder:text-stone-400 focus:bg-stone-50"
                          placeholder="Producto / modelo"
                        />
                        {typedErrors.products?.[index]?.productName?.message ? (
                          <p className="mt-1 text-xs font-medium text-rose-600">{typedErrors.products[index]?.productName?.message}</p>
                        ) : null}
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <input
                            {...register(`products.${index}.material`)}
                            className="border-0 border-b border-stone-200 bg-transparent pb-1 text-xs text-stone-600 outline-none placeholder:text-stone-400 focus:border-stone-500"
                            placeholder={isLeatherHouse ? "Material opcional" : "Material"}
                          />
                          <input
                            {...register(`products.${index}.color`)}
                            className="border-0 border-b border-stone-200 bg-transparent pb-1 text-xs text-stone-600 outline-none placeholder:text-stone-400 focus:border-stone-500"
                            placeholder="Color"
                          />
                        </div>
                        {typedErrors.products?.[index]?.material?.message ? (
                          <p className="mt-1 text-xs font-medium text-rose-600">{typedErrors.products[index]?.material?.message}</p>
                        ) : null}
                        {typedErrors.products?.[index]?.color?.message ? (
                          <p className="mt-1 text-xs font-medium text-rose-600">{typedErrors.products[index]?.color?.message}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 align-top text-right">
                        {isCommercialDocument ? (
                          <input
                            {...register(`products.${index}.unitPrice`)}
                            type="number"
                            min="0"
                            step="1"
                            className="h-9 w-28 rounded-md border border-transparent bg-transparent px-2 text-right text-sm text-stone-950 outline-none transition focus:border-stone-300 focus:bg-white"
                            placeholder="0"
                          />
                        ) : (
                          <span className="text-sm text-stone-400">-</span>
                        )}
                        {typedErrors.products?.[index]?.unitPrice?.message ? (
                          <p className="mt-1 text-xs font-medium text-rose-600">{typedErrors.products[index]?.unitPrice?.message}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-right align-top text-sm font-bold text-stone-950">
                        {isCommercialDocument ? formatCurrency(productTotal) : "-"}
                      </td>
                      <td className="px-2 py-4 align-top">
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                          className="grid size-8 place-items-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Eliminar producto"
                          title="Eliminar producto"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-5 border-b border-stone-200 px-4 py-4 lg:grid-cols-[1fr_260px] md:px-7">
            <div>
              <button
                type="button"
                onClick={() => append({ productName: "", material: "", color: "", quantity: 1 })}
                className="btn btn-secondary border-dashed"
              >
                <PackagePlus className="size-4" />
                Agregar producto
              </button>
              <div className="mt-4 grid max-w-xl gap-4 sm:grid-cols-2">
                <DocumentField label="Codigo pedido comun" error={typedErrors.groupCode?.message}>
                  <DocumentInput {...register("groupCode")} placeholder="Opcional" />
                </DocumentField>
                <DocumentField label="Plazo de entrega">
                  <p className="border-b border-stone-200 pb-1 text-sm font-semibold text-stone-950">{deliveryPeriodLabel(entryDateValue, deliveryDateValue)}</p>
                </DocumentField>
                <DocumentField label="Fecha estimada de entrega" error={typedErrors.deliveryDate?.message}>
                  <input {...register("deliveryDate")} type="date" className="w-full border-0 border-b border-stone-200 bg-transparent pb-1 text-sm font-semibold text-stone-950 outline-none focus:border-stone-500" />
                </DocumentField>
              </div>
            </div>
            {isCommercialDocument ? (
              <div className="overflow-hidden rounded-lg border border-stone-950">
                <div className="bg-stone-950 px-4 py-2 text-center text-xs font-bold uppercase tracking-[0.14em] text-white">Total</div>
                <div className="divide-y divide-stone-200 text-sm">
                  <SummaryRow label="Subtotal" value={formatCurrency(computedSubtotal)} />
                  <div className="grid grid-cols-[1fr_120px] items-center gap-3 px-4 py-2">
                    <span className="text-stone-500">Descuento</span>
                    <input {...register("discount")} type="number" min="0" step="1" className="border-0 border-b border-stone-200 bg-transparent text-right font-bold text-stone-950 outline-none focus:border-stone-500" />
                  </div>
                  <SummaryRow label="Neto" value={formatCurrency(computedNet)} />
                  <SummaryRow label="IVA 19%" value={formatCurrency(computedVat)} />
                  <SummaryRow label="Total" value={formatCurrency(computedTotal)} strong />
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 border-b border-stone-200 px-4 py-4 md:grid-cols-2 md:px-7">
            <PaymentDocumentBox title="Abono" amount={formatCurrency(computedPaid)}>
              <DocumentField label="Medio">
                <DocumentInput {...register("paymentMethod")} placeholder="Transferencia, efectivo, tarjeta..." />
              </DocumentField>
              <DocumentField label="Monto abonado" error={typedErrors.paidAmount?.message}>
                <input {...register("paidAmount")} type="number" min="0" step="1" className="mt-1 w-full border-0 border-b border-stone-200 bg-transparent pb-1 text-sm font-semibold text-stone-950 outline-none focus:border-stone-500" />
              </DocumentField>
            </PaymentDocumentBox>
            <PaymentDocumentBox title="Saldo" amount={formatCurrency(computedBalance)}>
              <p className="text-xs text-stone-500">Saldo pendiente calculado desde el total y el abono registrado.</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-stone-950" style={{ width: `${paymentProgress(computedPaid, computedTotal)}%` }} />
              </div>
            </PaymentDocumentBox>
          </div>

          <div className="border-b border-stone-200 px-4 py-4 text-center md:px-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">Condiciones de entrega</p>
            <textarea {...register("deliveryTerms")} className="mt-2 min-h-16 w-full resize-none border-0 bg-transparent text-center text-sm leading-6 text-stone-700 outline-none focus:bg-stone-50" />
          </div>

          <div className="grid gap-5 px-4 py-5 md:grid-cols-[1fr_220px] md:px-7">
            <div>
              <DocumentField label="Vendedor" error={typedErrors.sellerName?.message}>
                <DocumentInput {...register("sellerName")} placeholder="Vendedor" strong />
              </DocumentField>
              <label className="mt-4 flex w-fit items-center gap-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium">
                <input {...register("isWarranty")} type="checkbox" className="size-4 accent-stone-950" />
                Es garantia
              </label>
            </div>
            <div className="self-end text-center">
              <div className="border-b border-stone-950 pt-10" />
              <p className="mt-2 text-xs text-stone-500">Firma</p>
            </div>
          </div>

          <div className="border-t border-stone-200 bg-stone-50 px-4 py-4 md:px-7">
            <Field label="Observaciones" error={typedErrors.observations?.message} full>
              <textarea
                {...register("observations")}
                className="textarea-control min-h-24 bg-white"
                placeholder="Condiciones especiales, medidas, acuerdos, material pendiente..."
              />
            </Field>
            <div className="mt-4">
              <Field label="Adjunto inicial">
                <input
                  name="file"
                  type="file"
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                  className="block w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-stone-200 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-stone-800"
                />
              </Field>
              <p className="mt-2 text-xs text-stone-500">Maximo 10 MB. Se puede dejar vacio y adjuntar despues desde el detalle de la orden.</p>
            </div>
          </div>
        </section>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Link href="/admin" className="btn-lg btn-secondary">
            <ArrowLeft className="size-4" />
            Volver
          </Link>
          <button type="submit" disabled={pending} className="btn-lg btn-primary">
            <Save className="size-4" />
            {pending ? "Guardando..." : isLeatherHouse ? "Guardar ingreso" : "Guardar documento"}
          </button>
        </div>
        {showValidationSummary ? (
          <div aria-live="polite" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <p className="text-sm font-semibold">Faltan datos obligatorios</p>
            <p className="mt-1 text-sm">Completa los campos marcados arriba para poder guardar.</p>
          </div>
        ) : null}
        {state.message ? (
          <div
            aria-live="polite"
            className={
              state.status === "success"
                ? "flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"
                : "flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-950"
            }
          >
            {state.status === "success" ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 size-5 shrink-0" />
            )}
            <div>
              <p className="text-sm font-semibold">
                {state.status === "success" ? "Orden procesada" : "No se pudo guardar"}
              </p>
              <p className="mt-1 text-sm">{state.message}</p>
            </div>
          </div>
        ) : null}
      </form>
    );
  }

  return (
    <form action={formAction} onSubmit={submit} className="space-y-5">
      <section className="panel">
        <div className="panel-header flex items-center gap-3">
          {isLeatherHouse ? <Factory className="size-5 text-stone-500" /> : <FileText className="size-5 text-stone-500" />}
          <div>
            <h2 className="panel-title">{isLeatherHouse ? "Ingreso Leather House" : "Fabricación y venta de muebles - Muebles La Reina"}</h2>
            <p className="panel-description">
              {isLeatherHouse
                ? "Formulario simplificado orientado exclusivamente a fabricación."
                : "Documento base para nota de venta, cotización, garantía u orden de compra."}
            </p>
          </div>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Flujo" error={typedErrors.store?.message}>
            <select {...register("store")} className={inputClass}>
              <option value="LH">LH - ingreso de producción</option>
              <option value="LR">LR - documento comercial</option>
            </select>
          </Field>
          <Field label={isLeatherHouse ? "Código producción" : "Número documento"} error={typedErrors.salesNoteNumber?.message}>
            {orderId ? (
              <input {...register("salesNoteNumber")} className={inputClass} readOnly />
            ) : (
              <input {...register("salesNoteNumber")} className={inputClass} placeholder="Ej. LR-023" />
            )}
          </Field>
          {isCommercialDocument ? (
            <Field label="Tipo de documento" error={typedErrors.documentType?.message}>
              <select {...register("documentType")} className={inputClass}>
                <option value="sales_note">Nota de Venta</option>
                <option value="quote">Cotización</option>
                <option value="purchase_order">Orden de Compra</option>
                <option value="warranty">Garantía</option>
              </select>
            </Field>
          ) : (
            <input type="hidden" {...register("documentType")} value="production_intake" />
          )}
          <Field label="Estado documento" error={typedErrors.documentStatus?.message}>
            <select {...register("documentStatus")} className={inputClass}>
              <option value="draft">Borrador</option>
              <option value="issued">Emitido</option>
              <option value="approved">Aprobado</option>
              <option value="closed">Cerrado</option>
              <option value="cancelled">Anulado</option>
            </select>
          </Field>
          <Field label="Código pedido común" error={typedErrors.groupCode?.message}>
            <input {...register("groupCode")} className={inputClass} placeholder="Opcional, ej. LR2101" />
          </Field>
          {isCommercialDocument ? (
            <Field label="Vendedor" error={typedErrors.sellerName?.message}>
              <input {...register("sellerName")} className={inputClass} placeholder="Rodrigo Bravo G." />
            </Field>
          ) : null}
          <Field label="Cliente" error={typedErrors.clientName?.message}>
            <input {...register("clientName")} className={inputClass} placeholder="Persona o empresa" />
          </Field>
          {isCommercialDocument ? (
            <>
              <Field label="RUT" error={typedErrors.customerRut?.message}>
                <input {...register("customerRut")} className={inputClass} placeholder="14.567.890-3" />
              </Field>
              <Field label="Teléfono" error={typedErrors.customerPhone?.message}>
                <input {...register("customerPhone")} className={inputClass} placeholder="+56 9 8712 3456" />
              </Field>
              <Field label="Correo" error={typedErrors.customerEmail?.message}>
                <input {...register("customerEmail")} type="email" className={inputClass} placeholder="cliente@correo.cl" />
              </Field>
              <Field label="Dirección" error={typedErrors.customerAddress?.message}>
                <input {...register("customerAddress")} className={inputClass} placeholder="Av. Providencia 1652, Depto 4B" />
              </Field>
              <Field label="Comuna" error={typedErrors.customerCommune?.message}>
                <input {...register("customerCommune")} className={inputClass} placeholder="Providencia" />
              </Field>
              <input type="hidden" {...register("customerContact")} />
            </>
          ) : null}
        </div>
      </section>

      {orderId ? (
        <section className="panel">
          <div className="panel-header flex items-center gap-3">
            <PackagePlus className="size-5 text-stone-500" />
            <div>
              <h2 className="panel-title">Producto</h2>
              <p className="panel-description">Datos del producto asociado a esta fila.</p>
            </div>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <Field label="Producto / modelo" error={typedErrors.productName?.message} full>
              <input {...register("productName")} className={inputClass} placeholder="Sofa Chesterfield 200x090 cm" />
            </Field>
            <Field label="Material" error={typedErrors.material?.message}>
              <input {...register("material")} className={inputClass} placeholder={isLeatherHouse ? "Opcional" : "Cuero natural"} />
            </Field>
            <Field label="Color" error={typedErrors.color?.message}>
              <input {...register("color")} className={inputClass} placeholder="Riga Whisky" />
            </Field>
            {isCommercialDocument ? (
              <>
                <Field label="Cantidad" error={typedErrors.quantity?.message}>
                  <input {...register("quantity")} type="number" min="1" className={inputClass} />
                </Field>
                <Field label="Precio unitario" error={typedErrors.unitPrice?.message}>
                  <input {...register("unitPrice")} type="number" min="0" step="1" className={inputClass} />
                </Field>
              </>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="panel">
          <input type="hidden" name="productItems" value={JSON.stringify(products)} readOnly />
          <div className="panel-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <PackagePlus className="size-5 text-stone-500" />
              <div>
                <h2 className="panel-title">Productos</h2>
                <p className="panel-description">
                  {isCommercialDocument
                    ? "Cada producto queda en el documento y genera avance productivo propio."
                    : "Cada fila genera una etiqueta y avance productivo propio."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => append({ productName: "", material: "", color: "", quantity: 1 })}
              className="btn btn-secondary w-fit"
            >
              <PackagePlus className="size-4" />
              Agregar producto
            </button>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th className="w-14 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">N</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Producto</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Material</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Color</th>
                  {isCommercialDocument ? (
                    <>
                      <th className="w-28 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Cant.</th>
                      <th className="w-36 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Precio</th>
                    </>
                  ) : null}
                  <th className="w-12 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <tr key={field.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-3 py-3 align-top font-mono text-sm font-semibold text-stone-500">{index + 1}</td>
                    <td className="px-3 py-3 align-top">
                      <input {...register(`products.${index}.productName`)} className={inputClass} placeholder="Sofa Chesterfield 200x090 cm" />
                      {typedErrors.products?.[index]?.productName?.message ? (
                        <p className="mt-1 text-xs font-medium text-rose-600">{typedErrors.products[index]?.productName?.message}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <input {...register(`products.${index}.material`)} className={inputClass} placeholder={isLeatherHouse ? "Opcional" : "Cuero natural"} />
                      {typedErrors.products?.[index]?.material?.message ? (
                        <p className="mt-1 text-xs font-medium text-rose-600">{typedErrors.products[index]?.material?.message}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <input {...register(`products.${index}.color`)} className={inputClass} placeholder="Riga Whisky" />
                      {typedErrors.products?.[index]?.color?.message ? (
                        <p className="mt-1 text-xs font-medium text-rose-600">{typedErrors.products[index]?.color?.message}</p>
                      ) : null}
                    </td>
                    {isCommercialDocument ? (
                      <>
                        <td className="px-3 py-3 align-top">
                          <input {...register(`products.${index}.quantity`)} type="number" min="1" className={inputClass} />
                          {typedErrors.products?.[index]?.quantity?.message ? (
                            <p className="mt-1 text-xs font-medium text-rose-600">{typedErrors.products[index]?.quantity?.message}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <input {...register(`products.${index}.unitPrice`)} type="number" min="0" step="1" className={inputClass} />
                          {typedErrors.products?.[index]?.unitPrice?.message ? (
                            <p className="mt-1 text-xs font-medium text-rose-600">{typedErrors.products[index]?.unitPrice?.message}</p>
                          ) : null}
                        </td>
                      </>
                    ) : null}
                    <td className="px-3 py-3 align-top">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        className="grid size-10 place-items-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Eliminar producto"
                        title="Eliminar producto"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isCommercialDocument ? (
        <section className="panel">
          <div className="panel-header flex items-center gap-3">
            <DollarSign className="size-5 text-stone-500" />
            <div>
              <h2 className="panel-title">Valores y pagos</h2>
              <p className="panel-description">Abonos y saldos quedan asociados al documento comercial.</p>
            </div>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-4">
            <Field label="Subtotal" error={typedErrors.subtotal?.message}>
              <input {...register("subtotal")} type="number" min="0" step="1" className={inputClass} placeholder="0" readOnly />
            </Field>
            <Field label="Descuento" error={typedErrors.discount?.message}>
              <input {...register("discount")} type="number" min="0" step="1" className={inputClass} placeholder="0" />
            </Field>
            <Field label="Total" error={typedErrors.total?.message}>
              <input {...register("total")} type="number" min="0" step="1" className={inputClass} placeholder="0" readOnly />
            </Field>
            <Field label="Abono" error={typedErrors.paidAmount?.message}>
              <input {...register("paidAmount")} type="number" min="0" step="1" className={inputClass} placeholder="0" />
            </Field>
          </div>
          <div className="grid gap-3 border-t border-stone-200 p-4 md:grid-cols-3">
            <PaymentMetric label="Neto documento" value={formatCurrency(computedTotal)} />
            <PaymentMetric label="Neto sin IVA" value={formatCurrency(computedNet)} />
            <PaymentMetric label="IVA 19%" value={formatCurrency(computedVat)} />
            <PaymentMetric label="Total documento" value={formatCurrency(computedTotal)} emphasis />
            <PaymentMetric label="Abonado" value={formatCurrency(computedPaid)} />
            <PaymentMetric label="Saldo pendiente" value={formatCurrency(computedBalance)} emphasis />
          </div>
          <div className="grid gap-4 border-t border-stone-200 p-4 md:grid-cols-2">
            <Field label="Medio de pago" error={typedErrors.paymentMethod?.message}>
              <input {...register("paymentMethod")} className={inputClass} placeholder="Transferencia, efectivo, tarjeta..." />
            </Field>
            <Field label="Condiciones de entrega" error={typedErrors.deliveryTerms?.message} full>
              <textarea {...register("deliveryTerms")} className="textarea-control min-h-24 bg-white" />
            </Field>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-header flex items-center gap-3">
          <CalendarDays className="size-5 text-stone-500" />
          <div>
            <h2 className="panel-title">Planificación</h2>
            <p className="panel-description">Fechas, prioridad y condiciones productivas.</p>
          </div>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Fecha ingreso" error={typedErrors.entryDate?.message}>
            <input {...register("entryDate")} type="date" className={inputClass} />
          </Field>
          <Field label="Fecha entrega" error={typedErrors.deliveryDate?.message}>
            <input {...register("deliveryDate")} type="date" className={inputClass} />
          </Field>
          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">Prioridad</p>
            <p className="mt-1 text-sm font-semibold text-stone-800">Se calcula por fecha de entrega</p>
          </div>
          <label className="flex h-11 items-center gap-3 rounded-md border border-stone-200 bg-stone-50 px-3 text-sm font-medium">
            <input {...register("isWarranty")} type="checkbox" className="size-4 accent-stone-950" />
            Es garantía
          </label>
          <Field label="Observaciones" error={typedErrors.observations?.message} full>
            <textarea
              {...register("observations")}
              className="textarea-control min-h-28 bg-white"
              placeholder="Condiciones especiales, medidas, acuerdos, material pendiente..."
            />
          </Field>
        </div>
      </section>

      {!orderId ? (
        <section className="panel">
          <div className="panel-header flex items-center gap-3">
            <Paperclip className="size-5 text-stone-500" />
            <div>
              <h2 className="panel-title">Archivo adjunto</h2>
              <p className="panel-description">Plano, foto, PDF u otro documento de respaldo.</p>
            </div>
          </div>

          <div className="p-4">
            <Field label="Adjunto inicial">
              <input
                name="file"
                type="file"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                className="block w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-stone-200 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-stone-800"
              />
            </Field>
            <p className="mt-2 text-xs text-stone-500">Máximo 10 MB. Se puede dejar vacío y adjuntar después desde el detalle de la orden.</p>
          </div>
        </section>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Link href="/admin" className="btn-lg btn-secondary">
          <ArrowLeft className="size-4" />
          Volver
        </Link>
        <button type="submit" disabled={pending} className="btn-lg btn-primary">
          <Save className="size-4" />
          {pending ? "Guardando..." : orderId ? "Guardar cambios" : isLeatherHouse ? "Guardar ingreso" : "Guardar documento"}
        </button>
      </div>
      {showValidationSummary ? (
        <div aria-live="polite" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <p className="text-sm font-semibold">Faltan datos obligatorios</p>
          <p className="mt-1 text-sm">Completa los campos marcados arriba para poder guardar.</p>
        </div>
      ) : null}
      {state.message ? (
        <div
          aria-live="polite"
          className={
            state.status === "success"
              ? "flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"
              : "flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-950"
          }
        >
          {state.status === "success" ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 size-5 shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold">
              {state.status === "success" ? "Orden procesada" : "No se pudo guardar"}
            </p>
            <p className="mt-1 text-sm">{state.message}</p>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function OrderSuccessScreen({ message, orderId }: { message: string; orderId?: string }) {
  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-6">
        <div className="flex items-start gap-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Orden emitida</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">La orden fue emitida correctamente</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-700">{message}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-3">
        {orderId ? (
          <Link href={`/admin/orders/${orderId}`} className="btn-lg btn-primary sm:col-span-1">
            <FileText className="size-4" />
            Ver orden
          </Link>
        ) : null}
        <button type="button" onClick={() => window.location.assign("/admin/orders/new")} className="btn-lg btn-secondary">
          <PackagePlus className="size-4" />
          Nueva orden
        </button>
        <Link href="/admin" className="btn-lg btn-secondary">
          <ArrowLeft className="size-4" />
          Volver al panel
        </Link>
      </div>
    </section>
  );
}

function Field({
  label,
  error,
  full,
  children,
}: {
  label: string;
  error?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={full ? "md:col-span-2" : undefined}>
      <span className={labelClass}>{label}</span>
      <div className="mt-2">{children}</div>
      {error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null}
    </label>
  );
}

function PaymentMetric({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className={`mt-1 text-base font-semibold ${emphasis ? "text-rose-700" : "text-stone-950"}`}>{value}</p>
    </div>
  );
}

function DocumentField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">{label}</span>
      <div className="mt-1">{children}</div>
      {error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null}
    </label>
  );
}

const DocumentInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { strong?: boolean }>(
  function DocumentInput({ className = "", strong, ...props }, ref) {
    return (
      <input
        ref={ref}
        {...props}
        className={`w-full border-0 border-b border-stone-200 bg-transparent pb-1 text-sm outline-none placeholder:text-stone-400 focus:border-stone-500 ${
          strong ? "font-semibold text-stone-950" : "text-stone-700"
        } ${className}`}
      />
    );
  },
);

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-2">
      <span className={strong ? "text-base font-bold uppercase text-stone-950" : "text-stone-500"}>{label}</span>
      <span className={strong ? "text-base font-bold text-stone-950" : "font-bold text-stone-950"}>{value}</span>
    </div>
  );
}

function PaymentDocumentBox({
  title,
  amount,
  children,
}: {
  title: string;
  amount: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-3">
        <h3 className="text-sm font-bold uppercase text-stone-950">{title}</h3>
        <p className="text-xl font-bold text-stone-950">{amount}</p>
      </div>
      <div className="pt-3">{children}</div>
    </section>
  );
}

function lineTotal(quantity?: number, unitPrice?: number) {
  return (Number(quantity ?? 1) || 1) * (Number(unitPrice ?? 0) || 0);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function deliveryPeriodLabel(entryDate?: string, deliveryDate?: string) {
  if (!entryDate || !deliveryDate) return "Por definir";
  const start = new Date(`${entryDate}T00:00:00`);
  const end = new Date(`${deliveryDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Por definir";
  const days = Math.max(Math.round((end.getTime() - start.getTime()) / 86400000), 0);
  return `${days} dias corridos`;
}

function paymentProgress(paid: number, total: number) {
  if (!total) return 0;
  return Math.min(Math.round((paid / total) * 100), 100);
}
