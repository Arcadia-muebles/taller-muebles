"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Boxes, CalendarDays, CheckCircle2, FileText, Paperclip, Save, XCircle } from "lucide-react";
import Link from "next/link";
import { useActionState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { createOrder, updateOrder, type CreateOrderState } from "@/app/admin/orders/actions";
import { orderSchema, type OrderFormValues } from "@/lib/validation/order";

const inputClass = "control-lg bg-white";
const labelClass = "field-label";
const initialState: CreateOrderState = {
  status: "idle",
  message: "",
};

export function OrderForm({ orderId, initialValues }: { orderId?: string; initialValues?: OrderFormValues }) {
  const action = orderId ? updateOrder.bind(null, orderId) : createOrder;
  const [state, formAction, actionPending] = useActionState(action, initialState);
  const [formPending, startTransition] = useTransition();
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
  const [width, depth, height, material] = watch(["width", "depth", "height", "material"]);
  const w = Number(width) || 0;
  const d = Number(depth) || 0;
  const h = Number(height) || 0;
  const matName = material || "";

  const leatherQty = w && d && h ? Math.round(((w * d * 3 + w * h * 2 + d * h * 2) / 10000) * 10) / 10 : 0;
  const woodQty = w && d && h ? Math.max(2, Math.round((w * 2 + d * 4 + h * 4) / 100)) : 0;
  const foamQty = w && d && h ? Math.max(1, Math.round((w * d * 2) / 10000)) : 0;
  const pending = actionPending || formPending;
  const submit = handleSubmit((_values, event) => {
    if (!(event?.target instanceof HTMLFormElement)) return;
    const formData = new FormData(event.target);
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

            {w > 0 && d > 0 && h > 0 ? (
        <section className="panel border-amber-200 bg-amber-50/30">
          <div className="panel-header flex items-center gap-3">
            <Boxes className="size-5 text-amber-700" />
            <div>
              <h2 className="panel-title text-amber-950">Consumo Estimado de Materiales</h2>
              <p className="panel-description text-amber-800">Cálculo en tiempo real según las dimensiones ingresadas.</p>
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            <div className="rounded-md border border-amber-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Cuero (${matName || "Riga Honey"})</p>
              <p className="mt-2 text-2xl font-bold text-stone-900">${leatherQty} <span className="text-sm font-normal text-stone-500">m²</span></p>
              <p className="mt-1 text-xs text-stone-500">Fórmula: (Ancho×Prof×3 + Ancho×Alto×2 + Prof×Alto×2) / 10,000</p>
            </div>
            <div className="rounded-md border border-amber-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Madera estructura</p>
              <p className="mt-2 text-2xl font-bold text-stone-900">${woodQty} <span className="text-sm font-normal text-stone-500">tablas</span></p>
              <p className="mt-1 text-xs text-stone-500">Fórmula: (Ancho×2 + Prof×4 + Alto×4) / 100</p>
            </div>
            <div className="rounded-md border border-amber-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Espuma relleno</p>
              <p className="mt-2 text-2xl font-bold text-stone-900">${foamQty} <span className="text-sm font-normal text-stone-500">planchas</span></p>
              <p className="mt-1 text-xs text-stone-500">Fórmula: (Ancho×Prof×2) / 10,000</p>
            </div>
          </div>
          <div className="px-4 pb-4">
            <p className="text-xs leading-5 text-amber-800 font-medium">
              * Nota: Al guardar esta orden de producción, el stock disponible de estos materiales se descontará automáticamente.
            </p>
          </div>
        </section>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Link
          href="/admin"
          className="btn-lg btn-secondary"
        >     <ArrowLeft className="size-4" />
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
