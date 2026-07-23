"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Download,
  DollarSign,
  Factory,
  FileText,
  PackagePlus,
  Paperclip,
  Plus,
  Printer,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { forwardRef, useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Controller, useFieldArray, useForm, useWatch, type Control, type Resolver, type UseFormRegister } from "react-hook-form";
import { createOrder, updateOrder, type CreateOrderState } from "@/app/admin/orders/actions";
import type { CommercialDocumentType, StoreCode } from "@/lib/types";
import { newOrderSchema, orderSchema, type NewOrderFormValues, type OrderFormValues } from "@/lib/validation/order";

const inputClass = "control-lg bg-white";
const labelClass = "field-label";
const deliveryDayOptions = [10, 20, 30, 40, 50];
const paymentMethodOptions = ["Transferencia", "Efectivo", "Débito", "Crédito", "Webpay", "Cheque", "Otro"];
const initialState: CreateOrderState = {
  status: "idle",
  message: "",
};

type FormValues = OrderFormValues | NewOrderFormValues;
type PaymentFormValue = NonNullable<NewOrderFormValues["payments"]>[number];
type FieldErrors = Partial<Record<keyof OrderFormValues, { message?: string }>>;

export function OrderForm({
  orderId,
  initialValues,
  initialDocumentType = "sales_note",
  nextCodes = { LH: "LH-001", LR: "LR-001" },
  readOnly = false,
}: {
  orderId?: string;
  initialValues?: FormValues;
  initialDocumentType?: CommercialDocumentType;
  assignees?: string[];
  nextCodes?: Record<StoreCode, string>;
  readOnly?: boolean;
}) {
  const action = orderId ? updateOrder.bind(null, orderId) : createOrder;
  const [state, formAction, actionPending] = useActionState(action, initialState);
  const [formPending, startTransition] = useTransition();
  const [discountPercent, setDiscountPercent] = useState(0);
  const [pdfSaving, setPdfSaving] = useState(false);
  const [printPreparing, setPrintPreparing] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfSuccess, setPdfSuccess] = useState<string | null>(null);
  const lastAutoCode = useRef<string | null>(initialValues?.salesNoteNumber ?? nextCodes.LR);
  const defaultEntryDate = new Date().toISOString().slice(0, 10);
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
      documentType: initialDocumentType,
      documentStatus: "issued",
      salesNoteNumber: nextCodes.LR,
      isWarranty: false,
      entryDate: defaultEntryDate,
      deliveryDate: addDays(defaultEntryDate, 30),
      discount: 0,
      paidAmount: 0,
      customerPhone: "+56 ",
      sellerName: "Rodrigo Bravo G.",
      paymentMethod: "Transferencia",
      deliveryTerms: "El despacho dentro de Santiago no tiene costo. En caso de subir o bajar por escalas el costo será de $7.000.- por piso.",
      products: [{ productName: "", material: "", color: "", quantity: 1 }],
      payments: initialDocumentType === "quote" ? [] : [{ paidAt: defaultEntryDate, amount: 0, method: "Transferencia", note: "" }],
    },
  });
  const { fields: productFields, append: appendProduct, remove: removeProduct } = useFieldArray({
    control,
    name: "products",
  });
  const { fields: paymentFields, append: appendPayment, remove: removePayment, replace: replacePayments } = useFieldArray({
    control,
    name: "payments",
    keyName: "fieldKey",
  });
  const store = useWatch({ control, name: "store" });
  const documentType = useWatch({ control, name: "documentType" });
  const products = useWatch({ control, name: "products" }) ?? [];
  const watchedPayments = useWatch({ control, name: "payments" });
  const payments = useMemo(() => watchedPayments ?? [], [watchedPayments]);
  const quantity = useWatch({ control, name: "quantity" });
  const unitPrice = useWatch({ control, name: "unitPrice" });
  const discountValue = useWatch({ control, name: "discount" });
  const paidAmountValue = useWatch({ control, name: "paidAmount" });
  const entryDateValue = useWatch({ control, name: "entryDate" });
  const deliveryDateValue = useWatch({ control, name: "deliveryDate" });
  const isLeatherHouse = store === "LH";
  const isCommercialDocument = store === "LR";
  const isQuote = documentType === "quote";
  const documentLabel = commercialDocumentLabel(documentType);
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
    payments?: Array<{
      paidAt?: { message?: string };
      amount?: { message?: string };
      method?: { message?: string };
      note?: { message?: string };
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
    ? products.length
      ? products.reduce((sum, product) => sum + lineTotal(product.quantity, product.unitPrice), 0)
      : lineTotal(quantity, unitPrice)
    : 0;
  const computedDiscountPercent = clampPercent(discountPercent);
  const computedDiscount = !orderId && isCommercialDocument
    ? Math.round((computedSubtotal * computedDiscountPercent) / 100)
    : Number(discountValue ?? 0) || 0;
  const computedTotal = Math.max(computedSubtotal - computedDiscount, 0);
  const computedPaymentsPaid = payments.reduce((sum, payment) => sum + (Number(payment?.amount ?? 0) || 0), 0);
  const computedPaid = isCommercialDocument && payments.length ? computedPaymentsPaid : Number(paidAmountValue ?? 0) || 0;
  const computedBalance = Math.max(computedTotal - computedPaid, 0);
  const computedNet = Math.round(computedTotal / 1.19);
  const computedVat = Math.max(computedTotal - computedNet, 0);
  const deliveryDays = deliveryDaysBetween(entryDateValue, deliveryDateValue);
  const customerRutField = register("customerRut", {
    onChange: (event) => setValue("customerRut", formatRut(event.target.value), { shouldDirty: true, shouldValidate: false }),
  });
  const customerPhoneField = register("customerPhone", {
    onChange: (event) => setValue("customerPhone", formatChileanPhone(event.target.value), { shouldDirty: true, shouldValidate: false }),
  });

  useEffect(() => {
    if (!isCommercialDocument) return;
    setValue("subtotal", computedSubtotal, { shouldDirty: false, shouldValidate: true });
    setValue("discount", computedDiscount, { shouldDirty: false, shouldValidate: true });
    setValue("total", computedTotal, { shouldDirty: false, shouldValidate: true });
  }, [computedDiscount, computedSubtotal, computedTotal, isCommercialDocument, setValue]);

  useEffect(() => {
    if (!isCommercialDocument || !payments.length) return;
    setValue("paidAmount", computedPaymentsPaid, { shouldDirty: true, shouldValidate: true });
    setValue("paymentMethod", latestPaymentMethod(payments), { shouldDirty: true, shouldValidate: false });
  }, [computedPaymentsPaid, isCommercialDocument, payments, setValue]);

  useEffect(() => {
    if (orderId || !isQuote) return;
    if (payments.length) replacePayments([]);
    setValue("paidAmount", 0, { shouldDirty: true, shouldValidate: true });
    setValue("paymentMethod", "", { shouldDirty: true, shouldValidate: false });
  }, [isQuote, orderId, payments.length, replacePayments, setValue]);

  const submit = handleSubmit((_values, event) => {
    if (readOnly) return;
    if (!(event?.target instanceof HTMLFormElement)) return;
    const formData = new FormData(event.target);
    if (!orderId) formData.set("productItems", JSON.stringify(products));
    if (orderId && products[0]) {
      formData.set("productName", products[0].productName ?? "");
      formData.set("material", products[0].material ?? "");
      formData.set("color", products[0].color ?? "");
      formData.set("quantity", String(products[0].quantity ?? 1));
      formData.set("unitPrice", String(products[0].unitPrice ?? 0));
    }
    formData.set("paidAmount", String(computedPaid));
    formData.set("paymentMethod", payments.length ? latestPaymentMethod(payments) : String(getValues("paymentMethod") ?? ""));
    startTransition(() => formAction(formData));
  });

  function setDeliveryDays(days: number) {
    const baseDate = entryDateValue || new Date().toISOString().slice(0, 10);
    setValue("entryDate", baseDate, { shouldDirty: true, shouldValidate: true });
    setValue("deliveryDate", addDays(baseDate, days), { shouldDirty: true, shouldValidate: true });
  }

  async function saveSalesNotePdf() {
    const printArea = document.querySelector<HTMLElement>(".sales-note-print-area");
    if (!printArea || pdfSaving) return;

    setPdfSaving(true);
    setPdfError(null);
    setPdfSuccess(null);
    try {
      const [canvas, { jsPDF }] = await Promise.all([renderSalesNoteCanvas(printArea), import("jspdf")]);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const margin = 6;
      const availableWidth = 210 - margin * 2;
      const availableHeight = 297 - margin * 2;
      const scale = Math.min(availableWidth / canvas.width, availableHeight / canvas.height);
      const width = canvas.width * scale;
      const height = canvas.height * scale;
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", margin, margin, width, height, undefined, "FAST");
      pdf.save(pdfFileName(documentLabel, getValues("salesNoteNumber")));
      setPdfSuccess("PDF generado y descargado.");
    } catch (error) {
      console.error("No se pudo generar el PDF", error);
      setPdfError("No se pudo generar el PDF. Intenta nuevamente.");
    } finally {
      setPdfSaving(false);
    }
  }

  async function printSalesNote() {
    const printArea = document.querySelector<HTMLElement>(".sales-note-print-area");
    if (!printArea || printPreparing) return;

    setPrintPreparing(true);
    setPdfError(null);
    try {
      const canvas = await renderSalesNoteCanvas(printArea);
      const frame = document.createElement("iframe");
      frame.title = "Impresión de nota de venta";
      Object.assign(frame.style, { position: "fixed", width: "1px", height: "1px", right: "0", bottom: "0", border: "0", opacity: "0" });
      document.body.appendChild(frame);
      const frameDocument = frame.contentDocument;
      if (!frameDocument) throw new Error("No se pudo preparar la hoja de impresión.");
      frameDocument.open();
      frameDocument.write('<!doctype html><html><head><title>Nota de venta</title><style>@page{size:A4 portrait;margin:6mm}html,body{width:198mm;height:285mm;margin:0;overflow:hidden;background:#fff}img{display:block;width:100%;height:100%;object-fit:contain;object-position:top left}</style></head><body><img alt="Nota de venta"></body></html>');
      frameDocument.close();
      const image = frameDocument.querySelector("img");
      if (!image) throw new Error("No se pudo preparar la nota para impresión.");
      await new Promise<void>((resolve, reject) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => reject(new Error("No se pudo renderizar la nota.")), { once: true });
        image.src = canvas.toDataURL("image/jpeg", 0.96);
      });
      const cleanup = () => frame.remove();
      frame.contentWindow?.addEventListener("afterprint", cleanup, { once: true });
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      window.setTimeout(cleanup, 60_000);
    } catch (error) {
      console.error("No se pudo imprimir la nota", error);
      setPdfError("No se pudo preparar la impresión. Intenta nuevamente.");
    } finally {
      setPrintPreparing(false);
    }
  }

  if (!orderId && state.status === "success") {
    return <OrderSuccessScreen message={state.message} orderId={state.orderId} isQuote={state.documentType === "quote"} />;
  }

  if (isLeatherHouse) {
    return (
      <form key="leather-house-intake" action={formAction} onSubmit={submit} className="space-y-4">
        <input type="hidden" name="productItems" value={JSON.stringify(products)} readOnly />
        <input type="hidden" {...register("documentType")} value="production_intake" />
        <input type="hidden" {...register("documentStatus")} value="issued" />
        <input type="hidden" {...register("salesNoteNumber")} />
        <input type="hidden" {...register("groupCode")} />

        <section inert={readOnly ? true : undefined} className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-stone-200 bg-stone-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md border border-stone-200 bg-white">
                <Factory className="size-5 text-stone-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-stone-950">Ingreso de productos Leather House</h2>
                <p className="mt-0.5 text-sm text-stone-500">Todos los productos comparten cliente, fechas y código de orden.</p>
              </div>
            </div>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              Tienda
              <select {...register("store")} className="control min-w-56 bg-white text-sm normal-case tracking-normal">
                <option value="LH">Leather House - producción</option>
                <option value="LR">La Reina - documento comercial</option>
              </select>
            </label>
          </div>

          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <Field label="Nombre cliente" error={typedErrors.clientName?.message} full>
              <input {...register("clientName")} className={inputClass} placeholder="Nombre del cliente" autoFocus />
            </Field>
            <Field label="Fecha de ingreso" error={typedErrors.entryDate?.message}>
              <input {...register("entryDate")} type="date" className={inputClass} />
            </Field>
            <Field label="Fecha de entrega" error={typedErrors.deliveryDate?.message}>
              <input {...register("deliveryDate")} type="date" className={inputClass} />
            </Field>
          </div>

          <div className="border-t border-stone-200 bg-stone-50/60 p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-stone-950">Productos de la orden</h3>
                <p className="mt-1 text-xs text-stone-500">Cada producto tendrá su propio avance en producción.</p>
              </div>
              <button
                type="button"
                onClick={() => appendProduct({ productName: "", material: "", color: "", quantity: 1 })}
                className="btn btn-secondary w-fit"
              >
                <Plus className="size-4" />
                Agregar producto
              </button>
            </div>

            <div className="grid gap-3">
              {productFields.map((field, index) => (
                <div key={field.id} className="grid gap-3 rounded-lg border border-stone-200 bg-white p-4 sm:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-start">
                  <span className="grid size-9 place-items-center rounded-md bg-stone-100 font-mono text-sm font-semibold text-stone-600">
                    {index + 1}
                  </span>
                  <Field label="Producto" error={typedErrors.products?.[index]?.productName?.message}>
                    <input {...register(`products.${index}.productName`)} className={inputClass} placeholder="Producto o modelo" />
                  </Field>
                  <Field label="Color (opcional)" error={typedErrors.products?.[index]?.color?.message}>
                    <input {...register(`products.${index}.color`)} className={inputClass} placeholder="Color" />
                  </Field>
                  <div className="sm:pt-6">
                    <button
                      type="button"
                      onClick={() => removeProduct(index)}
                      disabled={productFields.length === 1}
                      className="grid size-11 place-items-center rounded-md border border-stone-200 text-stone-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={`Eliminar producto ${index + 1}`}
                      title="Eliminar producto"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <input type="hidden" {...register(`products.${index}.material`)} value="Por definir" />
                  <input type="hidden" {...register(`products.${index}.quantity`)} value={1} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Link href="/admin" className="btn-lg btn-secondary">
            <ArrowLeft className="size-4" />
            Volver
          </Link>
          {!readOnly ? <button type="submit" disabled={pending} className="btn-lg btn-primary">
            <Save className="size-4" />
            {pending ? "Guardando..." : orderId ? "Guardar cambios" : "Ingresar a producción"}
          </button> : null}
        </div>
        {showValidationSummary ? (
          <div aria-live="polite" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <p className="text-sm font-semibold">Faltan datos obligatorios</p>
            <p className="mt-1 text-sm">Completa el cliente, las fechas y el nombre de cada producto.</p>
          </div>
        ) : null}
        {state.message ? (
          <div aria-live="polite" className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-950">
            <XCircle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">No se pudo guardar</p>
              <p className="mt-1 text-sm">{state.message}</p>
            </div>
          </div>
        ) : null}
      </form>
    );
  }

  if (isCommercialDocument) {
    return (
      <form key="la-reina-document" action={formAction} onSubmit={submit} className="space-y-4">
        <input type="hidden" name="productItems" value={JSON.stringify(products)} readOnly />
        <input type="hidden" {...register("subtotal")} value={computedSubtotal} readOnly />
        <input type="hidden" {...register("discount")} value={computedDiscount} readOnly />
        <input type="hidden" {...register("total")} value={computedTotal} readOnly />
        <input type="hidden" {...register("customerContact")} />

        <section inert={readOnly ? true : undefined} className="sales-note-print-area overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
          <div className="sales-note-print-hidden border-b border-stone-200 bg-stone-50 px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                <FileText className="size-4" />
                Vista previa editable - {documentLabel.toLocaleLowerCase("es-CL")}
              </div>
              <div className="grid gap-2 sm:grid-cols-[auto_auto_180px_180px]">
                <button type="button" onClick={saveSalesNotePdf} disabled={pdfSaving} className="btn btn-secondary h-10 whitespace-nowrap">
                  <Download className="size-4" />
                  {pdfSaving ? "Guardando..." : "Guardar PDF"}
                </button>
                <button type="button" onClick={printSalesNote} disabled={printPreparing} className="btn btn-secondary h-10 whitespace-nowrap">
                  <Printer className="size-4" />
                  {printPreparing ? "Preparando..." : "Imprimir"}
                </button>
                <select {...register("store")} className="control bg-white">
                  <option value="LH">LH - producción</option>
                  <option value="LR">LR - comercial</option>
                </select>
                {isCommercialDocument ? (
                  <select {...register("documentType")} className="control bg-white">
                    <option value="sales_note">Nota de Venta</option>
                    <option value="quote">Cotización</option>
                    <option value="purchase_order">Orden de Compra</option>
                    <option value="warranty">Garantía</option>
                  </select>
                ) : (
                  <input type="hidden" {...register("documentType")} value="production_intake" />
                )}
                <input type="hidden" {...register("documentStatus")} value="issued" />
              </div>
            </div>
          </div>

          <div className="grid gap-5 border-b border-stone-300 px-4 py-5 md:grid-cols-[190px_1fr_170px] md:px-6">
            <div className="flex min-h-24 items-center justify-center">
              <Image
                src="/la-reina-logo.jpeg"
                alt="La Reina · Muebles en cuero"
                width={1600}
                height={874}
                className="h-auto w-full max-w-44"
                priority
                unoptimized
              />
            </div>
            <div className="text-center md:text-left">
              <h2 className="text-base font-bold uppercase tracking-[0.02em] text-stone-950">Fabricación y venta de muebles</h2>
              <div className="mt-2 grid gap-x-6 gap-y-1 text-xs leading-5 text-stone-600 lg:grid-cols-2">
                <p>Carmen #2001 - Santiago Centro</p>
                <p>Fono: 22 555 3795 - 22 556 5988</p>
                <p>www.muebleslareina.cl</p>
                <p>lareina@mueblesencuero.cl</p>
              </div>
            </div>
            <div className="md:text-right">
              <div className="inline-flex rounded-md border border-stone-200 px-3 py-2 text-sm font-bold uppercase text-stone-950">
                {isLeatherHouse ? "Ingreso taller" : documentLabel}
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

          <div className="border-b border-stone-300 bg-stone-50/70 px-4 py-4 md:px-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-stone-700">Datos del cliente</p>
            <div className="grid gap-x-10 gap-y-3 md:grid-cols-[1.15fr_0.8fr_0.8fr]">
              <div className="grid content-start gap-3">
                <DocumentField label="Nombre" error={typedErrors.clientName?.message}>
                  <DocumentInput {...register("clientName")} placeholder="Nombre del cliente" strong />
                </DocumentField>
                <DocumentField label="Dirección" error={typedErrors.customerAddress?.message}>
                  <DocumentInput {...register("customerAddress")} placeholder="Dirección de despacho o cliente" />
                </DocumentField>
                <DocumentField label="Correo" error={typedErrors.customerEmail?.message}>
                  <DocumentInput {...register("customerEmail")} type="email" placeholder="correo@cliente.cl" />
                </DocumentField>
              </div>
              <div className="grid content-start gap-3">
                <DocumentField label="Comuna" error={typedErrors.customerCommune?.message}>
                  <DocumentInput {...register("customerCommune")} placeholder="Comuna" />
                </DocumentField>
                {isCommercialDocument ? (
                  <DocumentField label="RUT" error={typedErrors.customerRut?.message}>
                    <DocumentInput {...customerRutField} placeholder="12.345.678-9" />
                  </DocumentField>
                ) : null}
              </div>
              {isCommercialDocument ? (
                <DocumentField label="Teléfono" error={typedErrors.customerPhone?.message}>
                  <DocumentInput {...customerPhoneField} placeholder="+56 ..." />
                </DocumentField>
              ) : null}
            </div>
          </div>

          <div className="sales-note-products-section flex min-h-[400px] flex-col border-b border-stone-300">
            <div className="overflow-x-auto">
              <table className="sales-note-products-table w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th className="w-14 px-4 py-2 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">Cant.</th>
                  <th className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">Descripción del producto</th>
                  <th className="w-32 px-4 py-2 text-right text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">Valor neto</th>
                  <th className="w-32 px-4 py-2 text-right text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">Valor bruto</th>
                  <th className="w-32 px-4 py-2 text-right text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">Valor total</th>
                  <th className="w-11 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {productFields.map((field, index) => {
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
                        <input type="hidden" {...register(`products.${index}.material`)} value="Por definir" />
                        <div className="mt-2">
                          <input
                            {...register(`products.${index}.color`)}
                            className="w-full border-0 border-b border-stone-200 bg-transparent pb-1 text-xs text-stone-600 outline-none placeholder:text-stone-400 focus:border-stone-500"
                            placeholder="Color"
                          />
                        </div>
                        {typedErrors.products?.[index]?.color?.message ? (
                          <p className="mt-1 text-xs font-medium text-rose-600">{typedErrors.products[index]?.color?.message}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-right align-top text-sm font-semibold text-stone-700">
                        {isCommercialDocument ? formatCurrency(unitNetValue(product.unitPrice)) : "-"}
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
                            aria-label={`Valor bruto unitario producto ${index + 1}`}
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
                          onClick={() => removeProduct(index)}
                          disabled={productFields.length === 1}
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
            <div className="sales-note-product-lines min-h-24 flex-1" aria-hidden="true" />
            <div className="grid items-end gap-5 px-4 pb-4 md:grid-cols-[1fr_260px] md:px-6">
              <div>
              <button
                type="button"
                onClick={() => appendProduct({ productName: "", material: "", color: "", quantity: 1 })}
                className="btn btn-secondary border-dashed"
              >
                <PackagePlus className="size-4" />
                Agregar producto
              </button>
              <input type="hidden" {...register("groupCode")} />
            </div>
            {isCommercialDocument ? (
              <div className="overflow-hidden rounded-lg border border-stone-950">
                <div className="bg-stone-950 px-4 py-2 text-center text-xs font-bold uppercase tracking-[0.14em] text-white">Total</div>
                <div className="divide-y divide-stone-200 text-sm">
                  <SummaryRow label="Subtotal" value={formatCurrency(computedSubtotal)} />
                  <div className="grid grid-cols-[1fr_120px] items-center gap-3 px-4 py-2">
                    <span className="text-stone-500">Descuento</span>
                    <label className="grid grid-cols-[1fr_auto] items-center gap-1 border-b border-stone-200 focus-within:border-stone-500">
                      <input
                        value={discountPercent}
                        onChange={(event) => setDiscountPercent(clampPercent(event.target.value))}
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        className="border-0 bg-transparent text-right font-bold text-stone-950 outline-none"
                      />
                      <span className="text-sm font-bold text-stone-500">%</span>
                    </label>
                  </div>
                  <SummaryRow label="Neto" value={formatCurrency(computedNet)} />
                  <SummaryRow label="IVA 19%" value={formatCurrency(computedVat)} />
                  <SummaryRow label="Total" value={formatCurrency(computedTotal)} strong />
                </div>
              </div>
            ) : null}
            </div>
          </div>

          <div className="grid border-b border-stone-300 bg-stone-50/70 px-4 py-3 md:grid-cols-2 md:divide-x md:divide-stone-300 md:px-6">
            <div className="flex items-center gap-3 pb-3 md:pb-0 md:pr-6">
              <CalendarDays className="size-4 shrink-0 text-stone-500" />
              <div className="min-w-0 flex-1">
                <DocumentField label="Plazo de entrega">
                  <DeliveryDaysControl days={deliveryDays} onSelect={setDeliveryDays} compact />
                </DocumentField>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-stone-200 pt-3 md:border-t-0 md:pl-6 md:pt-0">
              <CalendarDays className="size-4 shrink-0 text-stone-500" />
              <div className="min-w-0 flex-1">
                <DocumentField label="Fecha estimada de entrega" error={typedErrors.deliveryDate?.message}>
                  <input {...register("deliveryDate")} type="date" className="w-full border-0 border-b border-stone-200 bg-transparent pb-1 text-sm font-semibold text-stone-950 outline-none focus:border-stone-500" />
                </DocumentField>
              </div>
            </div>
            {pdfError || pdfSuccess ? (
              <p aria-live="polite" className={`mt-2 text-right text-xs font-medium ${pdfError ? "text-rose-700" : "text-emerald-700"}`}>
                {pdfError ?? pdfSuccess}
              </p>
            ) : null}
          </div>

          {!isQuote ? (
            <div className="grid gap-4 border-b border-stone-300 px-4 py-4 md:grid-cols-2 md:px-6">
              <PaymentDocumentBox title="Abono" amount={formatCurrency(computedPaid)}>
                <PaymentRows
                  control={control}
                  register={register}
                  fields={paymentFields}
                  errors={typedErrors.payments}
                  onAdd={() => appendPayment({ paidAt: new Date().toISOString().slice(0, 10), amount: 0, method: "Transferencia", note: "" })}
                  onRemove={removePayment}
                  compact
                />
                {orderId && !readOnly ? (
                  <button type="submit" disabled={pending} className="sales-note-print-hidden btn btn-primary mt-3 h-9">
                    <Save className="size-4" />
                    {pending ? "Guardando..." : "Guardar abonos"}
                  </button>
                ) : null}
                {orderId && state.message ? (
                  <p
                    aria-live="polite"
                    className={`mt-2 text-xs font-medium ${state.status === "success" ? "text-emerald-700" : "text-rose-700"}`}
                  >
                    {state.message}
                  </p>
                ) : null}
                {typedErrors.paidAmount?.message ? <p className="mt-2 text-xs font-medium text-rose-600">{typedErrors.paidAmount.message}</p> : null}
              </PaymentDocumentBox>
              <PaymentDocumentBox title="Saldo" amount={formatCurrency(computedBalance)}>
                <p className="text-xs text-stone-500">Saldo pendiente calculado desde el total y el abono registrado.</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-stone-950" style={{ width: `${paymentProgress(computedPaid, computedTotal)}%` }} />
                </div>
              </PaymentDocumentBox>
            </div>
          ) : null}

          {!isQuote ? (
            <div className="sales-note-print-signature px-4 py-3 text-center md:px-6">
              <div className="mx-auto w-64 border-b border-stone-700 pt-4" />
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">Nombre / firma / fecha</p>
            </div>
          ) : null}

          <div className={isQuote ? "" : "sales-note-print-hidden"}>
          {!isQuote ? (
            <div className="border-y border-stone-200 bg-stone-100 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500 md:px-7">
              Información interna · No se incluye en el PDF
            </div>
          ) : null}
          <div className="border-y border-stone-200 px-4 py-4 text-center md:px-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">
              {isQuote ? "Condiciones de la cotización" : "Condiciones de entrega"}
            </p>
            <textarea {...register("deliveryTerms")} className="mt-2 min-h-16 w-full resize-none border-0 bg-transparent text-center text-sm leading-6 text-stone-700 outline-none focus:bg-stone-50" />
          </div>

          <div className="grid gap-5 px-4 py-5 md:grid-cols-[1fr_220px] md:px-7">
            <div>
              <DocumentField label="Vendedor" error={typedErrors.sellerName?.message}>
                <DocumentInput {...register("sellerName")} placeholder="Vendedor" strong />
              </DocumentField>
              {!isQuote ? (
                <label className="mt-4 flex w-fit items-center gap-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium">
                  <input {...register("isWarranty")} type="checkbox" className="size-4 accent-stone-950" />
                  Es garantía
                </label>
              ) : <input type="hidden" {...register("isWarranty")} />}
            </div>
          </div>

          </div>
        </section>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Link href="/admin" className="btn-lg btn-secondary">
            <ArrowLeft className="size-4" />
            Volver
          </Link>
          {!readOnly ? <button type="submit" disabled={pending} className="btn-lg btn-primary">
            <Save className="size-4" />
            {pending ? "Guardando..." : orderId ? "Guardar cambios" : isQuote ? "Guardar cotización" : "Guardar documento"}
          </button> : null}
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
                <input {...customerRutField} className={inputClass} placeholder="14.567.890-3" />
              </Field>
              <Field label="Teléfono" error={typedErrors.customerPhone?.message}>
                <input {...customerPhoneField} className={inputClass} placeholder="+56 9 8712 3456" />
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
            <Field label="Color (opcional)" error={typedErrors.color?.message}>
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
              onClick={() => appendProduct({ productName: "", material: "", color: "", quantity: 1 })}
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
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Color (opcional)</th>
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
                {productFields.map((field, index) => (
                  <tr key={field.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-3 py-3 align-top font-mono text-sm font-semibold text-stone-500">{index + 1}</td>
                    <td className="px-3 py-3 align-top">
                      <input {...register(`products.${index}.productName`)} className={inputClass} placeholder="Sofa Chesterfield 200x090 cm" />
                      <input type="hidden" {...register(`products.${index}.material`)} value="Por definir" />
                      {typedErrors.products?.[index]?.productName?.message ? (
                        <p className="mt-1 text-xs font-medium text-rose-600">{typedErrors.products[index]?.productName?.message}</p>
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
                        onClick={() => removeProduct(index)}
                        disabled={productFields.length === 1}
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
            {!orderId ? (
              <div className="md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <span className={labelClass}>Abonos</span>
                  <button
                    type="button"
                    onClick={() => appendPayment({ paidAt: new Date().toISOString().slice(0, 10), amount: 0, method: "Transferencia", note: "" })}
                    className="btn btn-secondary h-9"
                  >
                    <Plus className="size-4" />
                    Agregar abono
                  </button>
                </div>
                <PaymentRows
                  control={control}
                  register={register}
                  fields={paymentFields}
                  errors={typedErrors.payments}
                  onAdd={() => appendPayment({ paidAt: new Date().toISOString().slice(0, 10), amount: 0, method: "Transferencia", note: "" })}
                  onRemove={removePayment}
                />
                {typedErrors.paidAmount?.message ? <p className="mt-2 text-xs font-medium text-rose-600">{typedErrors.paidAmount.message}</p> : null}
              </div>
            ) : (
              <Field label="Medio de pago" error={typedErrors.paymentMethod?.message}>
                <input {...register("paymentMethod")} className={inputClass} placeholder="Transferencia, efectivo, tarjeta..." />
              </Field>
            )}
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
          <Field label="Plazo de entrega">
            <DeliveryDaysControl days={deliveryDays} onSelect={setDeliveryDays} />
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

function OrderSuccessScreen({ message, orderId, isQuote }: { message: string; orderId?: string; isQuote: boolean }) {
  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-6">
        <div className="flex items-start gap-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">{isQuote ? "Cotización guardada" : "Orden emitida"}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
              {isQuote ? "La cotización quedó en Comercial" : "La orden fue emitida correctamente"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-700">{message}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-3">
        {orderId ? (
          <Link href={isQuote ? "/admin/documents" : `/admin/orders/${orderId}`} className="btn-lg btn-primary sm:col-span-1">
            <FileText className="size-4" />
            {isQuote ? "Ver cotizaciones" : "Ver orden"}
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

function DeliveryDaysControl({ days, onSelect, compact }: { days: number | undefined; onSelect: (days: number) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const label = days === undefined ? "Por definir" : `${days} días corridos`;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Cambiar plazo de entrega"
        className={`flex w-full items-center justify-between gap-3 border-b border-stone-200 pb-1 text-left text-sm font-semibold text-stone-950 transition hover:border-stone-500 ${compact ? "sales-note-print-value" : "rounded-md border border-stone-200 px-3 py-2"}`}
      >
        <span>{label}</span>
        <span className="sales-note-print-change text-xs font-medium text-stone-500">{open ? "Cerrar" : "Cambiar"}</span>
      </button>
      {open ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {deliveryDayOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onSelect(option);
                setOpen(false);
              }}
              className={`h-8 rounded-md border px-2.5 text-xs font-semibold transition ${
                days === option
                  ? "border-stone-950 bg-stone-950 text-white"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-400"
              }`}
            >
              {option} días
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PaymentRows({
  control,
  register,
  fields,
  errors,
  onAdd,
  onRemove,
  compact,
}: {
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  fields: Array<{ fieldKey: string }>;
  errors?: Array<{
    paidAt?: { message?: string };
    amount?: { message?: string };
    method?: { message?: string };
    note?: { message?: string };
  }>;
  onAdd: () => void;
  onRemove: (index: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-3" : "mt-2 space-y-3"}>
      {fields.map((field, index) => (
        <div key={field.fieldKey} className="rounded-md border border-stone-200 bg-stone-50/70 p-3">
          <input {...register(`payments.${index}.id` as const)} type="hidden" />
          <div className={compact ? "grid gap-2 sm:grid-cols-[105px_110px_1fr_1fr_36px]" : "grid gap-2 md:grid-cols-[150px_150px_1fr_1fr_40px]"}>
            <label>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500">Fecha</span>
              <input {...register(`payments.${index}.paidAt` as const)} type="date" className={compact ? documentPaymentInputClass : inputClass} />
              {errors?.[index]?.paidAt?.message ? <p className="mt-1 text-xs font-medium text-rose-600">{errors[index]?.paidAt?.message}</p> : null}
            </label>
            <label>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500">Monto</span>
              <Controller
                control={control}
                name={`payments.${index}.amount` as const}
                render={({ field }) => (
                  <input
                    ref={field.ref}
                    name={field.name}
                    value={formatClpInput(field.value)}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(parseClpInput(event.target.value))}
                    inputMode="numeric"
                    autoComplete="off"
                    className={compact ? documentPaymentInputClass : inputClass}
                    placeholder="0"
                  />
                )}
              />
              {errors?.[index]?.amount?.message ? <p className="mt-1 text-xs font-medium text-rose-600">{errors[index]?.amount?.message}</p> : null}
            </label>
            <label>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500">Medio</span>
              <select {...register(`payments.${index}.method` as const)} className={compact ? documentPaymentInputClass : inputClass}>
                {paymentMethodOptions.map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
              {errors?.[index]?.method?.message ? <p className="mt-1 text-xs font-medium text-rose-600">{errors[index]?.method?.message}</p> : null}
            </label>
            <label>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500">Nota</span>
              <input {...register(`payments.${index}.note` as const)} className={compact ? documentPaymentInputClass : inputClass} placeholder="Operacion, referencia..." />
              {errors?.[index]?.note?.message ? <p className="mt-1 text-xs font-medium text-rose-600">{errors[index]?.note?.message}</p> : null}
            </label>
            <button
              type="button"
              onClick={() => onRemove(index)}
              disabled={fields.length === 1}
              className="grid size-9 place-items-center self-end rounded-md text-stone-400 transition hover:bg-white hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Eliminar abono"
              title="Eliminar abono"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      ))}
      {compact ? (
        <button type="button" onClick={onAdd} className="btn btn-secondary h-9">
          <Plus className="size-4" />
          Agregar abono
        </button>
      ) : null}
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

const documentPaymentInputClass = "mt-1 w-full border-0 border-b border-stone-200 bg-transparent pb-1 text-sm font-semibold text-stone-950 outline-none focus:border-stone-500";

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

function copyFormValues(source: HTMLElement, target: HTMLElement) {
  const sourceFields = source.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select");
  const targetFields = target.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select");

  sourceFields.forEach((sourceField, index) => {
    const targetField = targetFields[index];
    if (!targetField) return;
    targetField.value = sourceField.value;
    if (sourceField instanceof HTMLInputElement && targetField instanceof HTMLInputElement) {
      targetField.checked = sourceField.checked;
    }
    if (sourceField instanceof HTMLTextAreaElement && targetField instanceof HTMLTextAreaElement) {
      targetField.textContent = sourceField.value;
    }
  });
}

async function renderSalesNoteCanvas(printArea: HTMLElement) {
  const exportArea = printArea.cloneNode(true) as HTMLElement;
  exportArea.classList.add("sales-note-pdf-export");
  exportArea.setAttribute("aria-hidden", "true");
  Object.assign(exportArea.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "748px",
    maxWidth: "none",
    pointerEvents: "none",
    zIndex: "-1",
  });
  copyFormValues(printArea, exportArea);
  document.body.appendChild(exportArea);

  try {
    await document.fonts.ready;
    await waitForImages(exportArea);
    const { default: html2canvas } = await import("html2canvas-pro");
    return await html2canvas(exportArea, {
      backgroundColor: "#ffffff",
      logging: false,
      scale: 2,
      useCORS: true,
    });
  } finally {
    exportArea.remove();
  }
}

async function waitForImages(root: HTMLElement) {
  await Promise.all(Array.from(root.querySelectorAll("img")).map((image) => image.decode().catch(() => undefined)));
}

function pdfFileName(documentLabel: string, documentCode?: string) {
  const safeLabel = documentLabel
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const safeCode = documentCode?.trim().replace(/[^a-zA-Z0-9_-]+/g, "-") || "sin-numero";
  return `${safeLabel || "documento"}-${safeCode}.pdf`;
}

function lineTotal(quantity?: number, unitPrice?: number) {
  return (Number(quantity ?? 1) || 1) * (Number(unitPrice ?? 0) || 0);
}

function unitNetValue(unitPrice?: number) {
  return Math.round((Number(unitPrice ?? 0) || 0) / 1.19);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatClpInput(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}

function parseClpInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function commercialDocumentLabel(type?: CommercialDocumentType) {
  const labels: Partial<Record<CommercialDocumentType, string>> = {
    sales_note: "Nota de venta",
    quote: "Cotización",
    purchase_order: "Orden de compra",
    warranty: "Garantía",
  };
  return type ? labels[type] ?? "Documento comercial" : "Documento comercial";
}

function clampPercent(value: number | string) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.min(Math.max(parsed, 0), 100);
}

function deliveryDaysBetween(entryDate?: string, deliveryDate?: string) {
  if (!entryDate || !deliveryDate) return undefined;
  const start = new Date(`${entryDate}T00:00:00`);
  const end = new Date(`${deliveryDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return undefined;
  return Math.max(Math.round((end.getTime() - start.getTime()) / 86400000), 0);
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatRut(value: string) {
  const clean = value.replace(/[^0-9kK]/g, "").toUpperCase();
  if (!clean) return "";
  const body = clean.slice(0, -1);
  const verifier = clean.slice(-1);
  const dottedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return body ? `${dottedBody}-${verifier}` : verifier;
}

function formatChileanPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  let local = digits.startsWith("56") ? digits.slice(2) : digits;
  local = local.slice(0, 9);
  if (!local) return "+56 ";
  if (local.startsWith("9")) {
    const first = local.slice(1, 5);
    const second = local.slice(5, 9);
    return `+56 9${first ? ` ${first}` : " "}${second ? ` ${second}` : ""}`;
  }
  const first = local.slice(0, 1);
  const second = local.slice(1, 5);
  const third = local.slice(5, 9);
  return `+56 ${first}${second ? ` ${second}` : ""}${third ? ` ${third}` : ""}`;
}

function latestPaymentMethod(payments: PaymentFormValue[] | undefined) {
  const validPayments = (payments ?? []).filter((payment) => Number(payment?.amount ?? 0) > 0);
  return validPayments.at(-1)?.method?.trim() || "";
}

function paymentProgress(paid: number, total: number) {
  if (!total) return 0;
  return Math.min(Math.round((paid / total) * 100), 100);
}
