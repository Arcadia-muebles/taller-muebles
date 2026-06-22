"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CalendarDays, CheckCircle2, FileText, Paperclip, Save, XCircle } from "lucide-react";
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

export function OrderForm({ orderId, initialValues, assignees }: { orderId?: string; initialValues?: OrderFormValues; assignees: string[] }) {
  const action = orderId ? updateOrder.bind(null, orderId) : createOrder;
  const [state, formAction, actionPending] = useActionState(action, initialState);
  const [formPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: initialValues ?? {
      store: "LH",
      priority: "normal",
      isWarranty: false,
      entryDate: new Date().toISOString().slice(0, 10),
    },
  });
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
          <Field label="Nota de venta" error={errors.salesNoteNumber?.message}>
            <input {...register("salesNoteNumber")} className={inputClass} placeholder="NV-2026-001" />
          </Field>
          <Field label="Cliente" error={errors.clientName?.message}>
            <input {...register("clientName")} className={inputClass} placeholder="Nombre cliente" />
          </Field>
          <Field label="Responsable inicial" error={errors.assignedTo?.message}>
            <select {...register("assignedTo")} className={inputClass}>
              <option value="">Seleccionar</option>
              {assignees.map((assignee) => <option key={assignee} value={assignee}>{assignee}</option>)}
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
          <Field label="Prioridad" error={errors.priority?.message}>
            <select {...register("priority")} className={inputClass}>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>
          </Field>
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
