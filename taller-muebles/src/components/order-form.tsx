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
import { useActionState, useEffect, useRef, useTransition } from "react";
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
  nextCodes = { LH: "LH-01", LR: "LR-01" },
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
      store: "LH",
      documentType: "production_intake",
      documentStatus: "issued",
      salesNoteNumber: nextCodes.LH,
      isWarranty: false,
      entryDate: new Date().toISOString().slice(0, 10),
      discount: 0,
      paidAmount: 0,
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

  return (
    <form action={formAction} onSubmit={submit} className="space-y-5">
      <section className="panel">
        <div className="panel-header flex items-center gap-3">
          {isLeatherHouse ? <Factory className="size-5 text-stone-500" /> : <FileText className="size-5 text-stone-500" />}
          <div>
            <h2 className="panel-title">{isLeatherHouse ? "Ingreso Leather House" : "Documento comercial La Reina"}</h2>
            <p className="panel-description">
              {isLeatherHouse
                ? "Formulario simplificado orientado exclusivamente a fabricacion."
                : "Documento base que alimenta automaticamente la produccion."}
            </p>
          </div>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Flujo" error={typedErrors.store?.message}>
            <select {...register("store")} className={inputClass}>
              <option value="LH">LH - ingreso de produccion</option>
              <option value="LR">LR - documento comercial</option>
            </select>
          </Field>
          <Field label={isLeatherHouse ? "Codigo produccion" : "Numero documento"} error={typedErrors.salesNoteNumber?.message}>
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
                <option value="quote">Cotizacion</option>
                <option value="purchase_order">Orden de Compra</option>
                <option value="warranty">Garantia</option>
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
          <Field label="Codigo pedido comun" error={typedErrors.groupCode?.message}>
            <input {...register("groupCode")} className={inputClass} placeholder="Opcional, ej. LR2101" />
          </Field>
          <Field label="Cliente" error={typedErrors.clientName?.message}>
            <input {...register("clientName")} className={inputClass} placeholder="Persona o empresa" />
          </Field>
          {isCommercialDocument ? (
            <>
              <Field label="RUT" error={typedErrors.customerRut?.message}>
                <input {...register("customerRut")} className={inputClass} placeholder="14.567.890-3" />
              </Field>
              <Field label="Telefono" error={typedErrors.customerPhone?.message}>
                <input {...register("customerPhone")} className={inputClass} placeholder="+56 9 8712 3456" />
              </Field>
              <Field label="Correo" error={typedErrors.customerEmail?.message}>
                <input {...register("customerEmail")} type="email" className={inputClass} placeholder="cliente@correo.cl" />
              </Field>
              <Field label="Direccion" error={typedErrors.customerAddress?.message}>
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
            <PaymentMetric label="Abonado" value={formatCurrency(computedPaid)} />
            <PaymentMetric label="Saldo pendiente" value={formatCurrency(computedBalance)} emphasis />
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-header flex items-center gap-3">
          <CalendarDays className="size-5 text-stone-500" />
          <div>
            <h2 className="panel-title">Planificacion</h2>
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
            Es garantia
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
            <p className="mt-2 text-xs text-stone-500">Maximo 10 MB. Se puede dejar vacio y adjuntar despues desde el detalle de la orden.</p>
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
