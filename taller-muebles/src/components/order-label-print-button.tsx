"use client";

import { Tag } from "lucide-react";
import type { Order } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function OrderLabelPrintButton({ order }: { order: Order }) {
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
        className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
      >
        <Tag className="size-4" />
        Etiqueta
      </button>
      <section className="label-print-area hidden">
        <div className="label-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">Arcadia</p>
              <h1 className="mt-2 font-mono text-3xl font-bold">{order.code}</h1>
              <p className="mt-1 font-mono text-sm font-semibold">Pedido {order.groupCode}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">Entrega</p>
              <p className="mt-2 text-lg font-bold">{formatDate(order.deliveryDate)}</p>
            </div>
          </div>
          <div className="mt-5 border-t border-black pt-4">
            <p className="text-xl font-bold">{order.product}</p>
            <p className="mt-2 text-base">{order.material} / {order.color}</p>
            <p className="mt-2 text-base">{order.client}</p>
          </div>
          {order.isWarranty ? <p className="mt-4 inline-block border border-black px-2 py-1 text-sm font-bold">GARANTIA</p> : null}
        </div>
      </section>
    </>
  );
}
