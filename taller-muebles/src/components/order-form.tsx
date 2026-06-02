"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CalendarDays, CheckCircle2, FileText, Save, XCircle } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { createOrder, type CreateOrderState } from "@/app/admin/orders/actions";
import { orderSchema, type OrderFormValues } from "@/lib/validation/order";

const inputClass =
  "h-11 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-stone-500";
const labelClass =
  "text-xs font-medium uppercase tracking-[0.14em] text-stone-500";
const initialState: CreateOrderState = {
  status: "idle",
  message: "",
};

export function OrderForm() {
  const [state, formAction, pending] = useActionState(createOrder, initialState);
  const {
    register,
    trigger,
    formState: { errors },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      store: "LH",
      priority: "normal",
      isWarranty: false,
      entryDate: new Date().toISOString().slice(0, 10),
    },
  });

  return (
    <form
      action={formAction}
      onSubmit={async (event) => {
        const valid = await trigger();
        if (!valid) {
          event.preventDefault();
        }
      }}
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

      <section className="rounded-lg border border-stone-200 bg-white">
        <div className="flex items-center gap-3 border-b border-stone-200 p-4">
          <FileText className="size-5 text-stone-500" />
          <div>
            <h2 className="text-base font-semibold">Datos comerciales</h2>
            <p className="text-sm text-stone-500">Informacion base de la nota de venta.</p>
          </div>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Tienda" error={errors.store?.message}>
            <select {...register("store")} className={inputClass}>
              <option value="LH">Leather House</option>
              <option value="LR">La Reina</option>
            </select>
          </Field>
          <Field label="Nota de venta" error={errors.salesNoteNumber?.message}>
            <input {...register("salesNoteNumber")} className={inputClass} placeholder="NV-2026-001" />
          </Field>
          <Field label="Cliente" error={errors.clientName?.message}>
            <input {...register("clientName")} className={inputClass} placeholder="Nombre cliente" />
          </Field>
          <Field label="Responsable inicial" error={errors.assignedTo?.message}>
            <select {...register("assignedTo")} className={inputClass}>
              <option value="">Seleccionar</option>
              <option value="Gustavo Rojas">Gustavo Rojas</option>
              <option value="Jan Spork">Jan Spork</option>
              <option value="Tony">Tony</option>
              <option value="LC01">LC01</option>
              <option value="LG02">LG02</option>
            </select>
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
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white">
        <div className="flex items-center gap-3 border-b border-stone-200 p-4">
          <CalendarDays className="size-5 text-stone-500" />
          <div>
            <h2 className="text-base font-semibold">Planificacion</h2>
            <p className="text-sm text-stone-500">Fechas, prioridad y condiciones productivas.</p>
          </div>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Fecha ingreso" error={errors.entryDate?.message}>
            <input {...register("entryDate")} type="date" className={inputClass} />
          </Field>
          <Field label="Fecha entrega" error={errors.deliveryDate?.message}>
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
              className="min-h-28 w-full rounded-md border border-stone-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-stone-500"
              placeholder="Condiciones especiales, medidas, acuerdos, material pendiente..."
            />
          </Field>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Link
          href="/admin"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700"
        >
          <ArrowLeft className="size-4" />
          Volver
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-stone-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="size-4" />
          {pending ? "Guardando..." : "Guardar nota"}
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
