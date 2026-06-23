"use client";

import { Tag } from "lucide-react";
import type { Order } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export function OrderLabelPrintButton({
  order,
  groupOrders = [order],
  className,
}: {
  order: Order;
  groupOrders?: Order[];
  className?: string;
}) {
  const orderedGroup = groupOrders.length ? groupOrders : [order];
  const productIndex = Math.max(orderedGroup.findIndex((item) => item.id === order.id), 0) + 1;
  const productTotal = orderedGroup.length || 1;
  const status = productionLabel(order);

  function printLabel() {
    document.body.classList.add("printing-label");
    window.print();
    window.setTimeout(() => document.body.classList.remove("printing-label"), 250);
  }

  return (
    <>
      <button
        type="button"
        onClick={printLabel}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50",
          className,
        )}
      >
        <Tag className="size-4" />
        Etiqueta
      </button>
      <section className="label-print-area hidden">
        <div className="label-card">
          <div>
            <div>
              <h1 className="mt-2 font-mono text-3xl font-bold">{order.code}</h1>
              <p className="mt-2 text-lg font-bold uppercase">{order.client}</p>
              <p className="mt-1 font-mono text-sm font-semibold">{productIndex}/{productTotal} Producto {productIndex} de {productTotal}</p>
            </div>
          </div>
          <div className="mt-5 border-t border-black pt-4">
            <p className="text-xl font-bold">{order.product}</p>
            <p className="mt-2 text-base">COLOR: {order.color}</p>
            <p className="mt-2 text-base">FECHA INGRESO: {formatDate(order.entryDate)}</p>
            <p className="mt-2 text-base">FECHA ENTREGA: {formatDate(order.deliveryDate)}</p>
            <p className="mt-2 text-base font-bold">ESTADO: {status}</p>
          </div>
          {order.isWarranty ? <p className="mt-4 inline-block border border-black px-2 py-1 text-sm font-bold">GARANTIA</p> : null}
        </div>
      </section>
    </>
  );
}

function productionLabel(order: Order) {
  if (order.status === "completed" || order.steps.every((step) => step.status === "done")) return "TERMINADO";
  const current =
    order.steps.find((step) => step.status === "active") ??
    order.steps.find((step) => step.status === "blocked") ??
    order.steps.find((step) => step.status === "pending");

  if (!current) return "PENDIENTE";

  const labels: Record<string, string> = {
    cutting: "EN CORTE",
    sewing: "EN COSTURA",
    upholstery: "EN TAPICERÍA",
    quality: "TERMINADO",
    dispatch: "TERMINADO",
  };

  return labels[current.key] ?? (current.status === "done" ? "TERMINADO" : "PENDIENTE");
}
