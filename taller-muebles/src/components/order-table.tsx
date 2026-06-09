"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Eye, MoreHorizontal, Pencil, Search, X, MessageSquare, Sofa, Armchair } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { completionPercent } from "@/lib/metrics";
import type { Order } from "@/lib/types";
import { cn, deliveryLabel, formatDate } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

type OrderTableProps = {
  orders: Order[];
  canEditOrders?: boolean;
  title?: string;
  description?: string;
  emptyText?: string;
};

function ProductImage({ product, color }: { product: string; color: string }) {
  const isArmchair = 
    product.toLowerCase().includes("sillón") || 
    product.toLowerCase().includes("silla") || 
    product.toLowerCase().includes("poltrona") ||
    product.toLowerCase().includes("eames") ||
    product.toLowerCase().includes("berger");
  
  let bgClass = "bg-[#FAF6F0] border-stone-200/50 text-[#9E7A5A]";
  const lowerColor = color.toLowerCase();
  
  if (lowerColor.includes("caramelo") || lowerColor.includes("whisky") || lowerColor.includes("café") || lowerColor.includes("burdeos")) {
    bgClass = "bg-[#F5ECE5] border-[#D9C3B0]/30 text-[#9E7A5A]";
  } else if (lowerColor.includes("topo") || lowerColor.includes("arena") || lowerColor.includes("gris")) {
    bgClass = "bg-stone-100 border-stone-200/40 text-stone-600";
  } else if (lowerColor.includes("nieve") || lowerColor.includes("blanco")) {
    bgClass = "bg-white border-stone-200/40 text-stone-400";
  } else if (lowerColor.includes("negro")) {
    bgClass = "bg-stone-900 border-stone-950 text-stone-300";
  }

  return (
    <div className={cn("size-10 rounded-lg flex items-center justify-center shrink-0 border shadow-sm select-none", bgClass)}>
      {isArmchair ? (
        <Armchair className="size-5" strokeWidth={1.5} />
      ) : (
        <Sofa className="size-5" strokeWidth={1.5} />
      )}
    </div>
  );
}

export function OrderTable({
  orders,
  canEditOrders = false,
  title = "Órdenes de producción",
  description,
  emptyText = "No hay órdenes que coincidan con los filtros.",
}: OrderTableProps) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  
  const filteredOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          (storeFilter === "all" || order.store === storeFilter) &&
          (priorityFilter === "all" || order.priority === priorityFilter),
      ),
    [orders, priorityFilter, storeFilter],
  );

  const columns = useMemo<ColumnDef<Order>[]>(
    () => [
      {
        accessorKey: "code",
        header: ({ column }) => (
          <button className="inline-flex items-center gap-1 hover:text-stone-850" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Código
            <ArrowUpDown className="size-3" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-1.5">
            <Link href={`/admin/orders/${row.original.id}`} className="truncate font-mono text-xs font-semibold text-stone-800 hover:text-[#9E7A5A] transition">
              {row.original.code}
            </Link>
            <span className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full text-stone-300 select-none">
              <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.746 3.746 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
            </span>
          </div>
        ),
      },
      {
        accessorKey: "client",
        header: "Cliente",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-bold text-stone-900 leading-tight">{row.original.client}</p>
            <p className="text-[10px] text-stone-400 font-semibold mt-0.5 leading-none">{row.original.store === "LH" ? "Leather House" : "La Reina"}</p>
          </div>
        ),
      },
      {
        accessorKey: "product",
        header: "Producto",
        cell: ({ row }) => {
          const order = row.original;
          return (
            <div className="flex items-center gap-3.5 min-w-0">
              <ProductImage product={order.product} color={order.color} />
              <div className="min-w-0">
                <p className="truncate font-bold text-stone-900 leading-tight">{order.product}</p>
                <p className="truncate text-xs text-stone-400 font-medium mt-0.5 leading-none">
                  {order.material} / {order.color}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => <StatusBadge type="order" value={row.original.status} order={row.original} />,
      },
      {
        accessorKey: "assignedTo",
        header: "Responsable",
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-stone-700 whitespace-nowrap">
            {row.original.assignedTo}
          </span>
        ),
      },
      {
        accessorKey: "deliveryDate",
        header: ({ column }) => (
          <button className="inline-flex items-center gap-1 hover:text-stone-850" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Entrega
            <ArrowUpDown className="size-3" />
          </button>
        ),
        cell: ({ row }) => {
          const isCompleted = row.original.status === "completed";
          const label = deliveryLabel(row.original.deliveryDate, isCompleted);
          const isRisk = !isCompleted && (label.startsWith("Vencido") || label === "Hoy" || label === "Mañana" || label.includes("1 día") || label.includes("2 días") || label.includes("3 días") || label.includes("4 días") || label.includes("5 días"));
          return (
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-stone-900 leading-tight">{formatDate(row.original.deliveryDate)}</p>
              <p className={cn("truncate text-[10px] font-semibold mt-0.5 leading-none", isRisk ? "text-rose-600 animate-pulse" : "text-stone-400")}>{label}</p>
            </div>
          );
        },
      },
      {
        id: "progress",
        header: "Avance",
        cell: ({ row }) => {
          const value = completionPercent(row.original);
          
          // Color dinámico idéntico a la imagen
          let barColor = "bg-emerald-500/80";
          if (value <= 20) barColor = "bg-rose-500/80";
          else if (value <= 50) barColor = "bg-amber-500/80";
          else if (value > 80) barColor = "bg-violet-500/80";

          return (
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-stone-500 w-7 text-right">{value}%</span>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-stone-100 border border-stone-200/20 shrink-0">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${value}%` }} />
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "priority",
        header: "Prioridad",
        cell: ({ row }) => {
          const p = row.original.priority;
          const isHigh = p === "critical" || p === "high";
          return (
            <span className={`inline-flex text-xs font-bold ${
              isHigh ? "text-rose-600" : "text-amber-600"
            }`}>
              {isHigh ? "Alta" : "Media"}
            </span>
          );
        },
      },
      {
        accessorKey: "observations",
        header: "Notas",
        cell: ({ row }) => {
          const count = row.original.commentCount ?? 0;
          return (
            <div className="flex items-center gap-1.5 text-stone-400 select-none">
              <MessageSquare className="size-4 text-stone-300" strokeWidth={1.5} />
              {count > 0 && <span className="text-xs font-bold text-stone-600">{count}</span>}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const order = row.original;
          const canEdit = canEditOrders && !["completed", "cancelled"].includes(order.status);

          return (
            <details className="group relative">
              <summary
                aria-label={`Acciones para ${order.code}`}
                className="grid size-8 cursor-pointer list-none place-items-center rounded-full border border-stone-200 bg-white text-stone-400 transition hover:border-stone-300 hover:text-stone-950 [&::-webkit-details-marker]:hidden"
              >
                <MoreHorizontal className="size-4" />
              </summary>
              <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-lg border border-stone-200 bg-white p-1 text-sm shadow-xl shadow-stone-950/10">
                <Link href={`/admin/orders/${order.id}`} className="flex h-9 items-center gap-2 rounded-md px-2.5 font-medium text-stone-700 transition hover:bg-stone-100 hover:text-stone-950">
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
        },
      },
    ],
    [canEditOrders],
  );

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
    <section className="min-w-0 max-w-full rounded-2xl border border-stone-200 bg-white shadow-sm shadow-stone-100/30">
      <div className="flex min-w-0 flex-col gap-4 border-b border-stone-200/50 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-serif font-medium text-stone-900">{title}</h2>
          <p className="text-xs text-stone-400 font-semibold mt-1">
            {description ?? (table.getFilteredRowModel().rows.length === 1 
              ? '1 orden visible' 
              : `${table.getFilteredRowModel().rows.length} órdenes visibles`)}
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end lg:w-auto">
          <select value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)} className="h-10 min-w-0 rounded-lg border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-750 outline-none">
            <option value="all">Todas las tiendas</option>
            <option value="LH">Leather House</option>
            <option value="LR">La Reina</option>
          </select>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="h-10 min-w-0 rounded-lg border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-750 outline-none">
            <option value="all">Toda prioridad</option>
            <option value="critical">Crítica</option>
            <option value="high">Alta</option>
            <option value="normal">Normal</option>
          </select>
          <label className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Buscar cliente, código o producto..."
              className="h-10 w-full rounded-lg border border-stone-200 bg-stone-50 pl-9 pr-3 text-xs font-semibold outline-none transition focus:border-stone-400 focus:bg-white"
            />
          </label>
          {globalFilter || storeFilter !== "all" || priorityFilter !== "all" ? (
            <button
              type="button"
              onClick={() => {
                setGlobalFilter("");
                setStoreFilter("all");
                setPriorityFilter("all");
              }}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-600 hover:bg-stone-50"
            >
              <X className="size-3.5" />
              Limpiar
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 p-4 xl:hidden">
        {visibleRows.map((row) => (
          <OrderCard key={row.id} order={row.original} canEditOrders={canEditOrders} />
        ))}
        {!visibleRows.length ? (
          <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-500">{emptyText}</div>
        ) : null}
      </div>

      <div className="hidden min-w-0 xl:block overflow-x-auto">
        <table className="w-full table-fixed border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-stone-200/50 bg-stone-50/40">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/20 transition">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="min-w-0 px-5 py-3 align-middle text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {!visibleRows.length ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-10 text-center text-sm text-stone-500">
                  {emptyText}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OrderCard({ order, canEditOrders }: { order: Order; canEditOrders: boolean }) {
  const progress = completionPercent(order);
  const canEdit = canEditOrders && !["completed", "cancelled"].includes(order.status);
  
  let barColor = "bg-emerald-500/80";
  if (progress <= 20) barColor = "bg-rose-500/80";
  else if (progress <= 50) barColor = "bg-amber-500/80";
  else if (progress > 80) barColor = "bg-violet-500/80";

  return (
    <article className="min-w-0 rounded-xl border border-stone-200 bg-stone-55/20 p-4 shadow-sm hover:shadow-md transition">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-3">
          <ProductImage product={order.product} color={order.color} />
          <div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Link href={`/admin/orders/${order.id}`} className="min-w-0 truncate font-mono text-sm font-bold text-stone-900 hover:underline">
                {order.code}
              </Link>
              <span className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full text-stone-300">
                <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.746 3.746 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
              </span>
            </div>
            <p className="mt-2 truncate text-sm font-bold text-stone-900">{order.client}</p>
            <p className="text-[10px] text-stone-400 font-semibold uppercase mt-0.5 leading-none">{order.store === "LH" ? "Leather House" : "La Reina"}</p>
          </div>
        </div>
        <StatusBadge type="order" value={order.status} order={order} />
      </div>

      <div className="mt-4 grid gap-2 text-xs text-stone-600 sm:grid-cols-3">
        <Info label="Responsable" value={order.assignedTo} />
        <Info label="Entrega" value={`${formatDate(order.deliveryDate)} · ${deliveryLabel(order.deliveryDate, order.status === "completed")}`} />
        <div className="min-w-0 rounded-xl border border-stone-200 bg-white p-3 flex flex-col justify-between">
          <p className="font-bold uppercase tracking-widest text-[9px] text-stone-400">Avance</p>
          <div className="mt-2 flex items-center gap-3">
            <span className="font-bold text-stone-600 text-xs">{progress}%</span>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100 border border-stone-200/10">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {order.observations ? <p className="mt-3.5 line-clamp-2 text-xs leading-relaxed text-stone-500 font-medium">{order.observations}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-stone-100">
        <Link href={`/admin/orders/${order.id}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 hover:bg-stone-50 transition">
          <Eye className="size-3.5 text-stone-400" />
          Ver detalle
        </Link>
        {canEdit ? (
          <Link href={`/admin/orders/${order.id}/edit`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 hover:bg-stone-50 transition">
            <Pencil className="size-3.5 text-stone-400" />
            Editar
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-stone-200 bg-white p-3">
      <p className="font-bold uppercase tracking-widest text-[9px] text-stone-400">{label}</p>
      <p className="mt-1 truncate font-semibold text-stone-700 text-xs">{value}</p>
    </div>
  );
}
