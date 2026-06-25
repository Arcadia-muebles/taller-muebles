"use client";

import { Tag } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import type { Order } from "@/lib/types";
import { orderStatusLabel } from "@/lib/orders";
import { cn } from "@/lib/utils";

export function OrderLabelPrintButton({
  order,
  groupOrders = [order],
  className,
  compact = false,
}: {
  order: Order;
  groupOrders?: Order[];
  className?: string;
  compact?: boolean;
}) {
  const orderedGroup = groupOrders.length ? groupOrders : [order];
  const productIndex = Math.max(orderedGroup.findIndex((item) => item.id === order.id), 0) + 1;
  const productTotal = orderedGroup.length || 1;
  const status = productionLabel(order);
  const brand = storeBrand(order.store);
  const qrValue = `pedido:${order.id}|codigo:${order.code}|tienda:${order.store}`;
  const observations = order.observations?.trim();
  const [printing, setPrinting] = useState(false);

  function printLabel() {
    setPrinting(true);
    document.body.classList.add("printing-label");
    window.print();
    window.setTimeout(() => {
      document.body.classList.remove("printing-label");
      setPrinting(false);
    }, 250);
  }

  return (
    <>
      <button
        type="button"
        onClick={printLabel}
        title="Imprimir etiqueta"
        aria-label={`Imprimir etiqueta de ${order.code}`}
        className={cn(
          compact
            ? "inline-grid size-7 shrink-0 place-items-center rounded-md border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950"
            : "inline-flex h-10 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50",
          className,
        )}
      >
        <Tag className="size-4" />
        {compact ? <span className="sr-only">Imprimir etiqueta</span> : "Imprimir etiqueta"}
      </button>
      <section className={cn("label-print-area hidden", printing && "is-printing-label")}>
        <div className="label-card">
          <aside className="label-brand-panel">
            <div className="label-brand">
              <div className="label-brand-mark" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <p className="label-brand-name">{brand.name}</p>
              <p className="label-brand-subtitle">{brand.subtitle}</p>
            </div>
            <div className="label-divider" />
            <p className="label-code">{order.code}</p>
            <div className="label-divider" />
            <QRCodeSVG value={qrValue} className="label-qr" level="M" marginSize={1} />
          </aside>

          <div className="label-detail-panel">
            <div className="label-section label-section-client">
              <p className="label-kicker">Cliente</p>
              <p className="label-client">{order.client || "Sin cliente"}</p>
            </div>

            <div className="label-section label-product-row">
              <div>
                <p className="label-kicker">Producto</p>
                <p className="label-product">{twoDigit(productIndex)} {order.product || "Sin producto"}</p>
              </div>
              <p className="label-count">{productIndex} de {productTotal}</p>
            </div>

            <div className="label-section">
              <p className="label-kicker">Color</p>
              <p className="label-color">{order.color || "Sin color"}</p>
            </div>

            <div className="label-date-grid">
              <div>
                <p className="label-kicker">Fecha ingreso</p>
                <p className="label-date">{formatShortDate(order.entryDate)}</p>
              </div>
              <div>
                <p className="label-kicker">Fecha entrega</p>
                <p className="label-date">{formatShortDate(order.deliveryDate)}</p>
              </div>
            </div>

            <div className="label-observations">
              <span>Observaciones</span>
              <p>{observations || "\u00a0"}</p>
            </div>

            <div className="label-status-row">
              <div className="label-status-icon" aria-hidden="true">✓</div>
              <div>
                <p className="label-kicker">Estado</p>
                <p className="label-status">{status}</p>
              </div>
            </div>

            <div className="label-footer-meta">
              <span>{order.material || "Sin material"}</span>
              <span>{order.isWarranty ? "Garantia" : orderStatusLabel(order.status)}</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function productionLabel(order: Order) {
  if (order.status === "cancelled") return "CANCELADO";
  if (order.status === "completed" || order.steps.every((step) => step.status === "done")) return "TERMINADO";
  const current =
    order.steps.find((step) => step.status === "active") ??
    order.steps.find((step) => step.status === "blocked") ??
    order.steps.find((step) => step.status === "pending");

  if (!current) return "PENDIENTE";
  if (order.status === "blocked" || current.status === "blocked") return "BLOQUEADO";
  if (current.status === "pending") return "PENDIENTE";

  const labels: Record<string, string> = {
    structure: "EN ESTRUCTURA",
    en_blanco: "EN BLANCO",
    cutting: "EN CORTE",
    sewing: "EN COSTURA",
    upholstery: "EN TAPICERÍA",
    quality: "TERMINADO",
    dispatch: "TERMINADO",
  };

  return labels[current.key] ?? (current.status === "done" ? "TERMINADO" : "PENDIENTE");
}

function storeBrand(store: Order["store"]) {
  if (store === "LR") return { name: "La Reina", subtitle: "Muebles en cuero" };
  return { name: "Leather House", subtitle: "Muebles en cuero" };
}

function twoDigit(value: number) {
  return value.toString().padStart(2, "0");
}

function formatShortDate(value?: string | null) {
  if (!value) return "S/F";
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "S/F";
  return `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear().toString().slice(-2)}`;
}
