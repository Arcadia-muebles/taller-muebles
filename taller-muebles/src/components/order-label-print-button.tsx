"use client";

import { Tag } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useRef } from "react";
import { orderStatusLabel } from "@/lib/orders";
import type { Order } from "@/lib/types";
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
  const labelRef = useRef<HTMLDivElement>(null);

  function printLabel() {
    const label = labelRef.current;
    if (!label) return;

    const frame = document.createElement("iframe");
    frame.title = `Etiqueta ${order.code}`;
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);

    const printDocument = frame.contentDocument ?? frame.contentWindow?.document;
    if (!printDocument) {
      frame.remove();
      return;
    }

    printDocument.open();
    printDocument.write(labelPrintDocument(label.outerHTML));
    printDocument.close();

    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
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

      <section className="hidden" aria-hidden="true">
        <div ref={labelRef} className="label-card">
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
                <p className="label-product">
                  {twoDigit(productIndex)} {order.product || "Sin producto"}
                </p>
              </div>
              <p className="label-count">
                {productIndex} de {productTotal}
              </p>
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
              <div className="label-status-icon" aria-hidden="true">
                OK
              </div>
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
    upholstery: "EN TAPICERIA",
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

function labelPrintDocument(labelMarkup: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Etiqueta</title>
  <style>${labelPrintCss()}</style>
</head>
<body>${labelMarkup}</body>
</html>`;
}

function labelPrintCss() {
  return `
@page {
  size: 150mm 95mm;
  margin: 0;
}

* {
  box-sizing: border-box;
}

html,
body {
  width: 150mm;
  height: 95mm;
  margin: 0;
  padding: 0;
  background: #ffffff;
  color: #000000;
  font-family: Arial, Helvetica, sans-serif;
}

.label-card {
  display: grid;
  grid-template-columns: 47mm 103mm;
  width: 150mm;
  height: 95mm;
  overflow: hidden;
  border: 0.6mm solid #000000;
  background: #ffffff;
}

.label-brand-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  border-right: 0.35mm solid #000000;
  padding: 4mm 3mm;
  text-align: center;
}

.label-brand {
  width: 100%;
}

.label-brand-mark {
  display: grid;
  grid-template-columns: repeat(3, 7mm);
  justify-content: center;
  align-items: end;
  gap: 0.7mm;
  height: 9mm;
  margin-bottom: 2mm;
}

.label-brand-mark span {
  display: block;
  width: 0;
  height: 0;
  border-right: 3.5mm solid transparent;
  border-left: 3.5mm solid transparent;
  border-bottom: 7mm solid #000000;
}

.label-brand-mark span:nth-child(2) {
  transform: translateY(-2mm);
}

.label-brand-name {
  margin: 0;
  overflow: hidden;
  font-size: 8mm;
  font-weight: 700;
  line-height: 0.95;
  text-transform: uppercase;
  white-space: nowrap;
}

.label-brand-subtitle {
  margin: 1.5mm 0 0;
  font-size: 2.4mm;
  font-weight: 800;
  letter-spacing: 0.9mm;
  text-transform: uppercase;
}

.label-divider {
  width: 100%;
  height: 0.35mm;
  margin: 4mm 0;
  background: #000000;
}

.label-code {
  width: 100%;
  margin: 0;
  overflow: hidden;
  font-family: "Arial Narrow", Arial, sans-serif;
  font-size: 19mm;
  font-weight: 900;
  line-height: 0.9;
  text-align: center;
  text-transform: uppercase;
  white-space: nowrap;
}

.label-qr {
  width: 29mm !important;
  height: 29mm !important;
  margin-top: auto;
}

.label-detail-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 4mm 5mm 3mm 5mm;
}

.label-section {
  min-width: 0;
  border-bottom: 0.3mm solid #000000;
  padding-bottom: 3mm;
}

.label-section + .label-section {
  padding-top: 3mm;
}

.label-kicker {
  margin: 0 0 1.2mm;
  font-size: 3.3mm;
  font-weight: 800;
  letter-spacing: 0.7mm;
  line-height: 1;
  text-transform: uppercase;
}

.label-client {
  margin: 0;
  overflow: hidden;
  font-family: "Arial Narrow", Arial, sans-serif;
  font-size: 8.5mm;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
}

.label-product-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 24mm;
  align-items: start;
  gap: 4mm;
}

.label-product {
  margin: 0;
  overflow: hidden;
  font-family: "Arial Narrow", Arial, sans-serif;
  font-size: 5.6mm;
  font-weight: 900;
  line-height: 1.05;
  text-transform: uppercase;
  white-space: nowrap;
}

.label-count {
  margin: 5.2mm 0 0;
  font-size: 4mm;
  font-weight: 900;
  line-height: 1;
  text-align: right;
  text-transform: uppercase;
  white-space: nowrap;
}

.label-color {
  margin: 0;
  overflow: hidden;
  font-size: 6mm;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
}

.label-date-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 0.3mm solid #000000;
}

.label-date-grid > div {
  min-width: 0;
  padding: 3mm 0;
}

.label-date-grid > div + div {
  border-left: 0.3mm solid #000000;
  padding-left: 6mm;
}

.label-date {
  margin: 0;
  font-size: 5mm;
  font-weight: 900;
  line-height: 1;
}

.label-observations {
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: end;
  gap: 3mm;
  border-bottom: 0.3mm solid #000000;
  padding: 2.5mm 0 2mm;
  text-transform: uppercase;
}

.label-observations span {
  font-size: 3mm;
  font-weight: 800;
  letter-spacing: 0.45mm;
  line-height: 1;
}

.label-observations p {
  min-height: 4mm;
  margin: 0;
  overflow: hidden;
  border-bottom: 0.25mm solid #000000;
  font-size: 3.2mm;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.label-status-row {
  display: grid;
  grid-template-columns: 12mm minmax(0, 1fr);
  align-items: center;
  gap: 3mm;
  padding-top: 2.8mm;
}

.label-status-icon {
  display: grid;
  width: 11.5mm;
  height: 11.5mm;
  place-items: center;
  border-radius: 999px;
  background: #000000;
  color: #ffffff;
  font-size: 3.2mm;
  font-weight: 900;
  line-height: 1;
}

.label-status {
  display: inline-block;
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  border-bottom: 0.6mm solid #000000;
  font-family: "Arial Narrow", Arial, sans-serif;
  font-size: 8mm;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
}

.label-footer-meta {
  display: flex;
  justify-content: space-between;
  gap: 4mm;
  margin-top: auto;
  overflow: hidden;
  font-size: 2.4mm;
  font-weight: 800;
  letter-spacing: 0.3mm;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
}
`;
}
