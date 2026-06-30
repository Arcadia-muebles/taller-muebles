"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  CheckCircle2,
  Circle,
  CircleDashed,
  Clock3,
  Eye,
  MessageSquareWarning,
  MoreHorizontal,
  Pencil,
  Scissors,
  Search,
  ShieldCheck,
  Sofa,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { completionPercent } from "@/lib/metrics";
import type { Order, OrderStatus, ProductionStep } from "@/lib/types";
import { cn, daysUntil, deliveryLabel, formatDate, hasMeaningfulObservations, priorityLabel } from "@/lib/utils";

type OrderTableProps = {
  orders: Order[];
  canEditOrders?: boolean;
  rowLinks?: boolean;
  hideActions?: boolean;
  detailPathPrefix?: string;
  title?: string;
  description?: string;
  emptyText?: string;
};

type ProductionTone = "green" | "blue" | "amber" | "purple" | "rose" | "stone";

export function OrderTable({
  orders,
  canEditOrders = false,
  rowLinks = false,
  hideActions = false,
  detailPathPrefix = "/admin/orders",
  title = "Órdenes de producción",
  description,
  emptyText = "No hay ordenes que coincidan con los filtros.",
}: OrderTableProps) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const groupOptions = useMemo(
    () => Array.from(new Set(orders.map((order) => order.groupCode).filter(Boolean))).sort(),
    [orders],
  );
  const filteredOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          (storeFilter === "all" || order.store === storeFilter) &&
          (priorityFilter === "all" || order.priority === priorityFilter) &&
          (groupFilter === "all" || order.groupCode === groupFilter),
      ),
    [groupFilter, orders, priorityFilter, storeFilter],
  );

  const columns = useMemo<ColumnDef<Order>[]>(
    () => {
      const baseColumns: ColumnDef<Order>[] = [
        {
          accessorKey: "code",
          header: ({ column }) => (
            <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
              Codigo / cliente
              <ArrowUpDown className="size-3.5" />
            </button>
          ),
          cell: ({ row }) => <CodeClientCell order={row.original} rowLinks={rowLinks} detailPathPrefix={detailPathPrefix} />,
        },
        {
          accessorKey: "product",
          header: "Producto",
          cell: ({ row }) => <ProductCell order={row.original} />,
        },
        {
          accessorKey: "color",
          header: "Color",
          cell: ({ row }) => (
            <span className="block max-w-28 truncate text-xs font-semibold uppercase text-stone-800">
              {row.original.color || "Sin color"}
            </span>
          ),
        },
        {
          accessorKey: "entryDate",
          header: ({ column }) => (
            <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
              F. ingreso
              <ArrowUpDown className="size-3.5" />
            </button>
          ),
          cell: ({ row }) => <span className="text-xs font-semibold text-stone-900">{compactDate(row.original.entryDate)}</span>,
        },
        {
          accessorKey: "deliveryDate",
          header: ({ column }) => (
            <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
              F. entrega
              <ArrowUpDown className="size-3.5" />
            </button>
          ),
          cell: ({ row }) => <span className="text-xs font-semibold text-stone-900">{compactDate(row.original.deliveryDate)}</span>,
        },
        {
          id: "term",
          header: "Plazo",
          cell: ({ row }) => (
            <span className="whitespace-nowrap text-xs font-semibold uppercase text-stone-800">
              {durationDays(row.original.entryDate, row.original.deliveryDate)}
            </span>
          ),
        },
        {
          id: "process",
          header: "Proceso",
          cell: ({ row }) => <ProcessTrack order={row.original} />,
        },
        {
          accessorKey: "status",
          header: "Estado",
          cell: ({ row }) => <ProductionStatusPill order={row.original} compact={false} />,
        },
        {
          id: "deliveryWindow",
          header: "Plazo para entrega",
          cell: ({ row }) => <DeliveryWindow order={row.original} />,
        },
        {
          id: "progress",
          header: "Avance",
          cell: ({ row }) => <ProgressMeter order={row.original} />,
        },
        {
          id: "actions",
          header: "",
          cell: ({ row }) => <ActionMenu order={row.original} canEditOrders={canEditOrders} detailPathPrefix={detailPathPrefix} />,
        },
      ];

      return hideActions ? baseColumns.filter((column) => column.id !== "actions") : baseColumns;
    },
    [canEditOrders, detailPathPrefix, hideActions, rowLinks],
  );

  // TanStack Table returns runtime helpers that React Compiler intentionally skips.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredOrders,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const visibleRows = table.getRowModel().rows;

  return (
    <section className="panel max-w-full overflow-hidden">
      <div className="panel-header flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="panel-title">{title}</h2>
          <p className="panel-description">{description ?? `${table.getFilteredRowModel().rows.length} ordenes visibles.`}</p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 md:w-auto md:flex-row md:flex-wrap md:justify-end">
          <select value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)} className="control min-w-0 bg-white text-stone-700 md:w-44">
            <option value="all">Todas las tiendas</option>
            <option value="LH">Leather House</option>
            <option value="LR">La Reina</option>
          </select>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="control min-w-0 bg-white text-stone-700 md:w-40">
            <option value="all">Toda urgencia</option>
            <option value="critical">Crítica</option>
            <option value="high">Alta</option>
            <option value="normal">Normal</option>
          </select>
          <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className="control min-w-0 bg-white text-stone-700 md:w-44">
            <option value="all">Todos los pedidos</option>
            {groupOptions.map((group) => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
          <label className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Buscar cliente, código o producto"
              className="control pl-9"
            />
          </label>
          {globalFilter || storeFilter !== "all" || priorityFilter !== "all" || groupFilter !== "all" ? (
            <button
              type="button"
              onClick={() => {
                setGlobalFilter("");
                setStoreFilter("all");
                setPriorityFilter("all");
                setGroupFilter("all");
              }}
              className="btn btn-secondary"
            >
              <X className="size-4" />
              Limpiar
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 p-3 lg:hidden">
        {visibleRows.map((row) => (
          <OrderCard key={row.id} order={row.original} canEditOrders={canEditOrders} rowLinks={rowLinks} hideActions={hideActions} detailPathPrefix={detailPathPrefix} />
        ))}
        {!visibleRows.length ? (
          <div className="empty-state">{emptyText}</div>
        ) : null}
      </div>

      <div className="hidden min-w-0 overflow-x-auto bg-stone-50/70 px-2 pb-2 lg:block">
        <table className="w-full min-w-[1040px] border-separate border-spacing-y-1.5">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className={cn("whitespace-nowrap px-2 pt-3 pb-1 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500", columnClass(header.column.id))}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const done = row.original.status === "completed";
              const rowHref = `${detailPathPrefix}/${row.original.id}`;

              return (
                <tr key={row.id} className={cn(rowLinks && "group cursor-pointer")}>
                  {row.getVisibleCells().map((cell, index) => {
                    const cellClass = cn(
                      "border-y border-stone-200 px-2 py-2.5 align-middle text-sm shadow-sm transition",
                      done ? "border-emerald-100 bg-emerald-50/70 group-hover:bg-emerald-50" : "bg-white group-hover:bg-stone-50",
                      index === 0 && "rounded-l-lg border-l",
                      index === row.getVisibleCells().length - 1 && "rounded-r-lg border-r",
                      columnClass(cell.column.id),
                    );

                    return rowLinks ? (
                      <td key={cell.id} className={cellClass}>
                        <Link href={rowHref} className="block min-h-12">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </Link>
                      </td>
                    ) : (
                      <td key={cell.id} className={cellClass}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {!visibleRows.length ? (
              <tr>
                <td colSpan={columns.length} className="rounded-lg border border-dashed border-stone-200 bg-white px-4 py-10 text-center text-sm text-stone-500">
                  {emptyText}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-stone-200 px-4 py-3 text-xs text-stone-500">
        <span>Urgencia calculada por entrega:</span>
        {(["critical", "high", "normal"] as const).map((key) => (
          <span key={key} className="rounded-full border border-stone-200 bg-stone-50 px-2 py-1">
            {priorityLabel(key)}
          </span>
        ))}
      </div>
    </section>
  );
}

function CodeClientCell({ order, rowLinks, detailPathPrefix }: { order: Order; rowLinks: boolean; detailPathPrefix: string }) {
  const content = (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-lg font-semibold text-stone-950 group-hover:underline">
          {order.code}
        </span>
        {order.isWarranty ? <ShieldCheck className="size-4 shrink-0 text-emerald-700" /> : null}
        {hasMeaningfulObservations(order.observations) ? (
          <MessageSquareWarning className="size-4 shrink-0 text-amber-600" aria-label="Tiene observaciones" />
        ) : null}
      </div>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.04em] text-stone-600">{order.store === "LH" ? "Leather House" : "La Reina"}</p>
    </div>
  );

  return rowLinks ? content : <Link href={`${detailPathPrefix}/${order.id}`}>{content}</Link>;
}

function ProductCell({ order }: { order: Order }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs font-semibold uppercase text-stone-950">{order.client}</p>
      <p className="mt-1 whitespace-normal break-words text-xs font-semibold uppercase leading-4 text-stone-800">{order.product}</p>
      <p className="mt-1 truncate text-xs font-medium uppercase text-stone-500">{order.material}</p>
    </div>
  );
}

function ProcessTrack({ order }: { order: Order }) {
  const visibleSteps = order.steps.slice(0, 4);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      {visibleSteps.map((step) => {
        const Icon = step.status === "done" ? CheckCircle2 : step.status === "active" ? processIcon(step) : CircleDashed;
        const active = step.status === "active" || step.status === "blocked";
        const done = step.status === "done";

        return (
          <span key={step.key} className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-stone-700">
            <span>{shortStepLabel(step.label)}</span>
            <Icon
              className={cn(
                "size-3.5 shrink-0",
                done && "text-emerald-700",
                active && toneText(statusPresentation(order).tone),
                step.status === "pending" && "text-stone-300",
              )}
            />
          </span>
        );
      })}
      {order.steps.length > visibleSteps.length ? (
        <span className="text-[10px] font-semibold text-stone-400">+{order.steps.length - visibleSteps.length}</span>
      ) : null}
    </div>
  );
}

function ProductionStatusPill({ order, compact }: { order: Order; compact: boolean }) {
  const presentation = statusPresentation(order);
  const Icon = presentation.icon;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold uppercase leading-none",
        tonePill(presentation.tone),
        compact ? "min-w-0" : "min-w-28",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className={cn("truncate", !compact && "text-center")}>{presentation.label}</span>
    </span>
  );
}

function DeliveryWindow({ order }: { order: Order }) {
  if (order.status === "completed") {
    return (
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-emerald-800">Entregado</p>
        <p className="mt-1 text-xs font-medium uppercase text-stone-600">{order.completedAt ? compactDate(order.completedAt) : formatDate(order.deliveryDate)}</p>
      </div>
    );
  }

  const days = daysUntil(order.deliveryDate);
  const overdue = Number.isFinite(days) && days < 0;
  const today = days === 0;

  return (
    <p className={cn("whitespace-nowrap text-sm font-semibold uppercase", overdue || today ? "text-rose-700" : "text-stone-950")}>
      {deliveryLabel(order.deliveryDate, false)}
    </p>
  );
}

function ProgressMeter({ order }: { order: Order }) {
  const value = completionPercent(order);
  const presentation = statusPresentation(order);

  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-semibold text-stone-900">{value}%</p>
      <div className="h-2.5 w-16 overflow-hidden rounded-full bg-stone-200">
        <div className={cn("h-full rounded-full", toneBar(presentation.tone))} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ActionMenu({ order, canEditOrders, detailPathPrefix }: { order: Order; canEditOrders: boolean; detailPathPrefix: string }) {
  const canEdit = canEditOrders && !["completed", "cancelled"].includes(order.status);

  return (
    <details className="group/action relative">
      <summary
        aria-label={`Acciones para ${order.code}`}
        className="grid size-9 cursor-pointer list-none place-items-center rounded-md border border-stone-200 bg-white text-stone-500 transition hover:border-stone-300 hover:text-stone-950 [&::-webkit-details-marker]:hidden"
      >
        <MoreHorizontal className="size-4" />
      </summary>
      <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-lg border border-stone-200 bg-white p-1 text-sm shadow-xl shadow-stone-950/10">
        <Link href={`${detailPathPrefix}/${order.id}`} className="flex h-9 items-center gap-2 rounded-md px-2.5 font-medium text-stone-700 transition hover:bg-stone-100 hover:text-stone-950">
          <Eye className="size-4 text-stone-400" />
          Ver detalle
        </Link>
        {canEdit ? (
          <Link href={`/admin/orders/${order.id}/edit`} className="flex h-9 items-center gap-2 rounded-md px-2.5 font-medium text-stone-700 transition hover:bg-stone-100 hover:text-stone-950">
            <Pencil className="size-4 text-stone-400" />
            Editar nota
          </Link>
        ) : (
          <p className="px-2.5 py-2 text-xs leading-5 text-stone-400">Solo lectura</p>
        )}
      </div>
    </details>
  );
}

function OrderCard({
  order,
  canEditOrders,
  rowLinks,
  hideActions,
  detailPathPrefix,
}: {
  order: Order;
  canEditOrders: boolean;
  rowLinks: boolean;
  hideActions: boolean;
  detailPathPrefix: string;
}) {
  const progress = completionPercent(order);
  const canEdit = canEditOrders && !["completed", "cancelled"].includes(order.status);

  const card = (
    <article className={cn("min-w-0 rounded-lg border p-3 shadow-sm", order.status === "completed" ? "border-emerald-100 bg-emerald-50/70" : "border-stone-200 bg-white", rowLinks && "group cursor-pointer hover:bg-stone-50")}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <CodeClientCell order={order} rowLinks={rowLinks} detailPathPrefix={detailPathPrefix} />
        <ProductionStatusPill order={order} compact />
      </div>

      <div className="mt-3 border-t border-stone-200 pt-3">
        <ProductCell order={order} />
      </div>

      <div className="mt-3 grid gap-2 text-xs text-stone-600 sm:grid-cols-3">
        <Info label="Ingreso" value={formatDate(order.entryDate)} />
        <Info label="Entrega" value={`${formatDate(order.deliveryDate)} - ${deliveryLabel(order.deliveryDate, order.status === "completed")}`} />
        <div className="min-w-0 rounded-md border border-stone-200 bg-white p-2">
          <p className="font-medium uppercase tracking-[0.12em] text-stone-400">Avance</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200">
            <div className={cn("h-full rounded-full", toneBar(statusPresentation(order).tone))} style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 font-semibold text-stone-700">{progress}%</p>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-stone-200 bg-white p-2">
        <p className="font-medium uppercase tracking-[0.12em] text-stone-400">Proceso</p>
        <div className="mt-2">
          <ProcessTrack order={order} />
        </div>
      </div>

      {hasMeaningfulObservations(order.observations) ? (
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-stone-500">{order.observations}</p>
      ) : null}

      {!hideActions ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`${detailPathPrefix}/${order.id}`} className="btn btn-secondary h-9">
            <Eye className="size-4 text-stone-400" />
            Ver detalle
          </Link>
          {canEdit ? (
            <Link href={`/admin/orders/${order.id}/edit`} className="btn btn-secondary h-9">
              <Pencil className="size-4 text-stone-400" />
              Editar
            </Link>
          ) : null}
        </div>
      ) : null}
    </article>
  );

  return rowLinks ? <Link href={`${detailPathPrefix}/${order.id}`} className="block">{card}</Link> : card;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-card">
      <p className="meta-label">{label}</p>
      <p className="mt-1 truncate font-semibold text-stone-700">{value}</p>
    </div>
  );
}

function statusPresentation(order: Order): { label: string; tone: ProductionTone; icon: React.ElementType } {
  if (order.status === "completed") return { label: "Entregado", tone: "green", icon: Truck };
  if (order.status === "cancelled") return { label: "Cancelada", tone: "stone", icon: Circle };
  if (order.status === "blocked" || order.steps.some((step) => step.status === "blocked")) return { label: "Bloqueada", tone: "rose", icon: CircleDashed };
  if (order.status === "quality_control") return { label: "Listo para entrega", tone: "green", icon: CheckCircle2 };
  if (order.status === "draft" || order.status === "scheduled") return { label: "Sin iniciar", tone: "stone", icon: Clock3 };

  const step = currentProductionStep(order);
  if (!step) return { label: statusLabel(order.status), tone: order.status === "urgent" ? "amber" : "stone", icon: Clock3 };

  return {
    label: `En ${stepLabel(step.label)}`,
    tone: stepTone(step),
    icon: processIcon(step),
  };
}

function currentProductionStep(order: Order) {
  return (
    order.steps.find((step) => step.status === "active") ??
    order.steps.find((step) => step.status === "blocked") ??
    order.steps.find((step) => step.status === "pending")
  );
}

function processIcon(step: ProductionStep) {
  const key = `${step.key} ${step.label}`.toLowerCase();
  if (key.includes("cut") || key.includes("corte")) return Scissors;
  if (key.includes("dispatch") || key.includes("despacho")) return Truck;
  if (key.includes("quality") || key.includes("calidad")) return CheckCircle2;
  return Sofa;
}

function stepTone(step: ProductionStep): ProductionTone {
  const key = `${step.key} ${step.label}`.toLowerCase();
  if (key.includes("cut") || key.includes("corte")) return "blue";
  if (key.includes("structure") || key.includes("estructura")) return "purple";
  if (key.includes("quality") || key.includes("calidad") || key.includes("dispatch") || key.includes("despacho")) return "green";
  if (key.includes("sewing") || key.includes("costura") || key.includes("upholstery") || key.includes("tapicer")) return "amber";
  return "stone";
}

function stepLabel(label: string) {
  const normalized = label
    .replace(/^en\s+/i, "")
    .trim()
    .toLowerCase();
  if (normalized.includes("calidad")) return "control de calidad";
  return normalized;
}

function shortStepLabel(label: string) {
  return label
    .replace("Estructura", "Estruct.")
    .replace("Revision de calidad", "Calidad")
    .replace("Tapiceria", "Tapic.")
    .replace("Despacho", "Terminado")
    .trim();
}

function statusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    draft: "Borrador",
    scheduled: "Programada",
    in_production: "En producción",
    blocked: "Bloqueada",
    urgent: "Urgente",
    quality_control: "Listo para entrega",
    completed: "Entregado",
    cancelled: "Cancelada",
  };
  return labels[status];
}

function compactDate(value?: string | null) {
  if (!value) return "-";
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date).replace(/\//g, "-");
}

function durationDays(entryDate?: string | null, deliveryDate?: string | null) {
  if (!entryDate || !deliveryDate) return "Sin plazo";
  const start = new Date(entryDate.includes("T") ? entryDate : `${entryDate}T00:00:00`);
  const end = new Date(deliveryDate.includes("T") ? deliveryDate : `${deliveryDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Sin plazo";
  const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
  return `${days} días`;
}

function tonePill(tone: ProductionTone) {
  const classes: Record<ProductionTone, string> = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    blue: "border-sky-200 bg-sky-50 text-sky-800",
    amber: "border-orange-200 bg-orange-50 text-orange-700",
    purple: "border-violet-200 bg-violet-50 text-violet-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    stone: "border-stone-200 bg-stone-50 text-stone-700",
  };
  return classes[tone];
}

function toneText(tone: ProductionTone) {
  const classes: Record<ProductionTone, string> = {
    green: "text-emerald-700",
    blue: "text-sky-700",
    amber: "text-orange-600",
    purple: "text-violet-700",
    rose: "text-rose-700",
    stone: "text-stone-600",
  };
  return classes[tone];
}

function toneBar(tone: ProductionTone) {
  const classes: Record<ProductionTone, string> = {
    green: "bg-emerald-600",
    blue: "bg-sky-500",
    amber: "bg-orange-500",
    purple: "bg-violet-500",
    rose: "bg-rose-500",
    stone: "bg-stone-500",
  };
  return classes[tone];
}

function columnClass(id: string) {
  const classes: Record<string, string> = {
    code: "w-[130px]",
    product: "w-[185px]",
    color: "w-[90px]",
    entryDate: "w-[90px]",
    deliveryDate: "w-[90px]",
    term: "w-[75px]",
    process: "w-[180px]",
    status: "w-[125px]",
    deliveryWindow: "w-[115px]",
    progress: "w-[80px]",
    actions: "w-[50px]",
  };
  return classes[id] ?? "";
}
