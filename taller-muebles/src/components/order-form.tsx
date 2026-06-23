"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CalendarDays, CheckCircle2, FileText, PackagePlus, Paperclip, Save, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useActionState, useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { createOrder, updateOrder, type CreateOrderState } from "@/app/admin/orders/actions";
import { newOrderSchema, orderSchema, type NewOrderFormValues, type OrderFormValues } from "@/lib/validation/order";

const inputClass = "control-lg bg-white";
const labelClass = "field-label";
const initialState: CreateOrderState = {
  status: "idle",
  message: "",
};

type FormValues = OrderFormValues | NewOrderFormValues;

export function OrderForm({ orderId, initialValues }: { orderId?: string; initialValues?: OrderFormValues; assignees?: string[] }) {
  const action = orderId ? updateOrder.bind(null, orderId) : createOrder;
  const [state, formAction, actionPending] = useActionState(action, initialState);
  const [formPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(orderId ? orderSchema : newOrderSchema),
    defaultValues: initialValues ?? {
      store: "LH",
      isWarranty: false,
      entryDate: new Date().toISOString().slice(0, 10),
      products: [{ productName: "", material: "", color: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "products",
  });
  const products = useWatch({ control, name: "products" }) ?? [];
  const pending = actionPending || formPending;
  const submit = handleSubmit((_values, event) => {
    if (!(event?.target instanceof HTMLFormElement)) return;
    const formData = new FormData(event.target);
    if (!orderId) formData.set("productItems", JSON.stringify(products));
    startTransition(() => formAction(formData));
  });

  return (
    <form
      action={formAction}
      onSubmit={submit}
      className="space-y-5"
    >
      {state.message ? (
        <div
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

      <section className="panel">
        <div className="panel-header flex items-center gap-3">
          <FileText className="size-5 text-stone-500" />
          <div>
            <h2 className="panel-title">Datos comerciales</h2>
            <p className="panel-description">Información base de la nota de venta.</p>
          </div>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Tienda" error={errors.store?.message}>
            <select {...register("store")} className={inputClass}>
              <option value="LH">Leather House</option>
              <option value="LR">La Reina</option>
            </select>
          </Field>
          <Field label="Código venta" error={errors.salesNoteNumber?.message}>
            {orderId ? (
              <input {...register("salesNoteNumber")} className={inputClass} readOnly />
            ) : (
              <input className={inputClass} value="Se genera automáticamente" readOnly />
            )}
          </Field>
          <Field label="Código pedido común" error={errors.groupCode?.message}>
            <input {...register("groupCode")} className={inputClass} placeholder="Opcional, ej. LH2101" />
          </Field>
          <Field label="Cliente" error={errors.clientName?.message}>
            <input {...register("clientName")} className={inputClass} placeholder="Persona o empresa" />
          </Field>
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
            <Field label="Producto / modelo" error={(errors as Partial<Record<keyof OrderFormValues, { message?: string }>>).productName?.message} full>
              <input {...register("productName")} className={inputClass} placeholder="Sofa Chesterfield 200x090 cm" />
            </Field>
            <Field label="Material" error={(errors as Partial<Record<keyof OrderFormValues, { message?: string }>>).material?.message}>
              <input {...register("material")} className={inputClass} placeholder="Cuero natural" />
            </Field>
            <Field label="Color" error={(errors as Partial<Record<keyof OrderFormValues, { message?: string }>>).color?.message}>
              <input {...register("color")} className={inputClass} placeholder="Riga Whisky" />
            </Field>
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
                <p className="panel-description">Cada fila genera una etiqueta y avance productivo propio.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => append({ productName: "", material: "", color: "" })}
              className="btn btn-secondary w-fit"
            >
              <PackagePlus className="size-4" />
              Agregar producto
            </button>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th className="w-14 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">N</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Producto</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Material</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Color</th>
                  <th className="w-12 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <tr key={field.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-3 py-3 align-top font-mono text-sm font-semibold text-stone-500">{index + 1}</td>
                    <td className="px-3 py-3 align-top">
                      <input {...register(`products.${index}.productName`)} className={inputClass} placeholder="Sofa Chesterfield 200x090 cm" />
                      {(errors as { products?: Array<{ productName?: { message?: string } }> }).products?.[index]?.productName?.message ? (
                        <p className="mt-1 text-xs font-medium text-rose-600">{(errors as { products?: Array<{ productName?: { message?: string } }> }).products?.[index]?.productName?.message}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <input {...register(`products.${index}.material`)} className={inputClass} placeholder="Cuero natural" />
                      {(errors as { products?: Array<{ material?: { message?: string } }> }).products?.[index]?.material?.message ? (
                        <p className="mt-1 text-xs font-medium text-rose-600">{(errors as { products?: Array<{ material?: { message?: string } }> }).products?.[index]?.material?.message}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <input {...register(`products.${index}.color`)} className={inputClass} placeholder="Riga Whisky" />
                      {(errors as { products?: Array<{ color?: { message?: string } }> }).products?.[index]?.color?.message ? (
                        <p className="mt-1 text-xs font-medium text-rose-600">{(errors as { products?: Array<{ color?: { message?: string } }> }).products?.[index]?.color?.message}</p>
                      ) : null}
                    </td>
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

      <section className="panel">
        <div className="panel-header flex items-center gap-3">
          <CalendarDays className="size-5 text-stone-500" />
          <div>
            <h2 className="panel-title">Planificacion</h2>
            <p className="panel-description">Fechas, prioridad y condiciones productivas.</p>
          </div>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Fecha ingreso" error={errors.entryDate?.message}>
            <input {...register("entryDate")} type="date" className={inputClass} />
          </Field>
          <Field label="Fecha entrega" error={errors.deliveryDate?.message}>
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
          <Field label="Observaciones" error={errors.observations?.message} full>
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
        <Link
          href="/admin"
          className="btn-lg btn-secondary"
        >
          <ArrowLeft className="size-4" />
          Volver
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="btn-lg btn-primary"
        >
          <Save className="size-4" />
          {pending ? "Guardando..." : orderId ? "Guardar cambios" : "Guardar nota"}
        </button>
      </div>
    </form>
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
