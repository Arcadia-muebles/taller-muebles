"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Boxes, CalendarDays, CheckCircle2, FileText, Paperclip, Plus, Save, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { createOrder, updateOrder, type CreateOrderState } from "@/app/admin/orders/actions";
import type { StockItem } from "@/lib/types";
import { orderSchema, type OrderFormValues } from "@/lib/validation/order";

const inputClass = "control-lg bg-white";
const labelClass = "field-label";
const initialState: CreateOrderState = {
  status: "idle",
  message: "",
};

type ConsumptionRow = {
  id: string;
};

export function OrderForm({
  orderId,
  initialValues,
  stockItems = [],
}: {
  orderId?: string;
  initialValues?: OrderFormValues;
  stockItems?: StockItem[];
}) {
  const action = orderId ? updateOrder.bind(null, orderId) : createOrder;
  const [state, formAction, actionPending] = useActionState(action, initialState);
  const [formPending, startTransition] = useTransition();
  const [consumptionRows, setConsumptionRows] = useState<ConsumptionRow[]>([{ id: crypto.randomUUID() }]);
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema) as any,
    defaultValues: initialValues ?? {
      store: "LH",
      priority: "normal",
      isWarranty: false,
      entryDate: new Date().toISOString().slice(0, 10),
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const [width, depth, height] = watch(["width", "depth", "height"]);
  const hasDimensions = Number(width) > 0 && Number(depth) > 0 && Number(height) > 0;
  const pending = actionPending || formPending;
  const submit = handleSubmit((_values, event) => {
    if (!(event?.target instanceof HTMLFormElement)) return;
    const formData = new FormData(event.target);
    startTransition(() => formAction(formData));
  });

  function addConsumptionRow() {
    setConsumptionRows((rows) => [...rows, { id: crypto.randomUUID() }]);
  }

  function removeConsumptionRow(id: string) {
    setConsumptionRows((rows) => rows.length > 1 ? rows.filter((row) => row.id !== id) : rows);
  }

  return (
    <form action={formAction} onSubmit={submit} className="space-y-5">
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
            <p className="panel-description">Informacion base de la nota de venta.</p>
          </div>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Empresa Cliente" error={errors.store?.message}>
            <select {...register("store")} className={inputClass}>
              <option value="LH">Leather House</option>
              <option value="LR">La Reina</option>
            </select>
          </Field>
          <Field label="Nota de venta" error={errors.salesNoteNumber?.message}>
            <input {...register("salesNoteNumber")} className={inputClass} placeholder="NV-2026-001" />
          </Field>
          <Field label="Producto / modelo" error={errors.productName?.message} full>
            <input {...register("productName")} className={inputClass} placeholder="Sofa Modena 240x95..." />
          </Field>
          <Field label="Material" error={errors.material?.message}>
            <input {...register("material")} className={inputClass} placeholder="Cuero natural" />
          </Field>
          <Field label="Color" error={errors.color?.message}>
            <input {...register("color")} className={inputClass} placeholder="Riga Honey" />
          </Field>
          <Field label="Ancho (cm)" error={errors.width?.message}>
            <input type="number" {...register("width")} className={inputClass} placeholder="200" />
          </Field>
          <Field label="Profundidad (cm)" error={errors.depth?.message}>
            <input type="number" {...register("depth")} className={inputClass} placeholder="90" />
          </Field>
          <Field label="Alto (cm)" error={errors.height?.message}>
            <input type="number" {...register("height")} className={inputClass} placeholder="80" />
          </Field>
        </div>
      </section>

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
          <Field label="Fecha entrega estimada (opcional)" error={errors.deliveryDate?.message}>
            <input {...register("deliveryDate")} type="date" className={inputClass} />
          </Field>
          <Field label="Prioridad" error={errors.priority?.message}>
            <select {...register("priority")} className={inputClass}>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
              <option value="critical">Critica</option>
            </select>
          </Field>
          <label className="flex h-11 items-center gap-3 rounded-md border border-stone-200 bg-stone-50 px-3 text-sm font-medium">
            <input {...register("isWarranty")} type="checkbox" className="size-4 accent-stone-950" />
            Es garantia
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
            <Boxes className="size-5 text-stone-500" />
            <div>
              <h2 className="panel-title">Materiales a descontar</h2>
              <p className="panel-description">Registra solo cantidades reales o confirmadas para esta orden.</p>
            </div>
          </div>

          <div className="space-y-3 p-4">
            {hasDimensions ? (
              <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-600">
                Dimensiones ingresadas: {width} x {depth} x {height} cm. Aun no hay reglas de consumo configuradas, por eso el stock solo se descuenta con las cantidades que indiques abajo.
              </p>
            ) : (
              <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-600">
                Cuando definan reglas por producto y dimension, esta seccion podra precargar consumos. Por ahora evita descuentos inventados.
              </p>
            )}

            {stockItems.length ? (
              <>
                <div className="space-y-2">
                  {consumptionRows.map((row, index) => (
                    <div key={row.id} className="grid gap-3 rounded-md border border-stone-200 bg-white p-3 md:grid-cols-[minmax(0,1.3fr)_150px_minmax(0,1fr)_44px]">
                      <Field label={`Material ${index + 1}`}>
                        <select name="consumptionMaterialId" defaultValue="" className={inputClass}>
                          <option value="">Sin descuento</option>
                          {stockItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} - disponible {item.available} {item.unit}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Cantidad">
                        <input name="consumptionQuantity" type="number" min="0" step="0.01" placeholder="0" className={inputClass} />
                      </Field>
                      <Field label="Referencia">
                        <input name="consumptionNotes" placeholder="Ej. cuero cuerpo sofa" className={inputClass} />
                      </Field>
                      <button
                        type="button"
                        onClick={() => removeConsumptionRow(row.id)}
                        disabled={consumptionRows.length === 1}
                        className="mt-6 inline-flex size-11 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 disabled:opacity-40"
                        aria-label="Quitar material"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addConsumptionRow} className="btn-lg btn-secondary">
                  <Plus className="size-4" />
                  Agregar material
                </button>
              </>
            ) : (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-amber-900">
                No hay materiales activos en stock. Puedes crear la orden, pero no se descontara inventario.
              </p>
            )}
          </div>
        </section>
      ) : null}

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
