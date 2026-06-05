"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Eye, MoreHorizontal, Paperclip, Pencil, Search, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Order } from "@/lib/types";
import { completionPercent } from "@/lib/metrics";
import { cn, deliveryLabel, formatDate } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

type OrderTableProps = {
  orders: Order[];
  canEditOrders?: boolean;
  title?: string;
  description?: string;
  emptyText?: string;
};

const priorityLabel = {
  normal: "Normal",
  high: "Alta",
  critical: "Critica",
};

export function OrderTable({
  orders,
  canEditOrders = false,
  title = "Ordenes de produccion",
  description,
  emptyText = "No hay ordenes que coincidan con los filtros.",
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
          <button
            className="inline-flex items-center gap-1.5"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Codigo
            <ArrowUpDown className="size-3.5" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/orders/${row.original.id}`}
              className="font-mono text-sm font-semibold underline-offset-4 hover:underline"
            >
              {row.original.code}
            </Link>
            {row.original.isWarranty ? (
              <span title="Garantia">
                <ShieldCheck className="size-4 text-violet-600" />
              </span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "client",
        header: "Cliente",
        cell: ({ row }) => (
          <div className="min-w-44">
            <p className="font-medium text-stone-950">{row.original.client}</p>
            <p className="text-xs text-stone-500">{row.original.store}</p>
          </div>
        ),
      },
      {
        accessorKey: "product",
        header: "Producto",
        cell: ({ row }) => (
          <div className="min-w-64">
            <p className="font-medium">{row.original.product}</p>
            <p className="text-xs text-stone-500">
              {row.original.material} / {row.original.color}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => <StatusBadge type="order" value={row.original.status} />,
      },
      {
        accessorKey: "assignedTo",
        header: "Responsable",
        cell: ({ row }) => (
          <span className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium">
            {row.original.assignedTo}
          </span>
        ),
      },
      {
        accessorKey: "deliveryDate",
        header: ({ column }) => (
          <button
            className="inline-flex items-center gap-1.5"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Entrega
            <ArrowUpDown className="size-3.5" />
          </button>
        ),
        cell: ({ row }) => {
          const isCompleted = row.original.status === "completed";
          const label = deliveryLabel(row.original.deliveryDate, isCompleted);
          const isRisk =
            !isCompleted &&
            (label.startsWith("Vencido") || label === "Hoy" || label === "Mañana");
          return (
            <div>
              <p className="text-sm font-medium">{formatDate(row.original.deliveryDate)}</p>
              <p className={cn("text-xs font-semibold", isRisk ? "text-rose-600" : "text-stone-500")}>
                {label}
              </p>
            </div>
          );
        },
      },
      {
        id: "progress",
        header: "Avance",
        cell: ({ row }) => {
          const value = completionPercent(row.original);
          return (
            <div className="w-32">
              <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${value}%` }}
                />
              </div>
              <p className="mt-1 text-xs font-medium text-stone-500">{value}%</p>
            </div>
          );
        },
      },
      {
        accessorKey: "observations",
        header: "Notas",
        cell: ({ row }) => (
          <div className="flex max-w-56 items-center gap-2 text-xs text-stone-600">
            <Paperclip className="size-3.5 shrink-0 text-stone-400" />
            <span className="truncate">{row.original.observations}</span>
          </div>
        ),
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
                className="grid size-9 cursor-pointer list-none place-items-center rounded-md border border-stone-200 bg-white text-stone-500 transition hover:border-stone-300 hover:text-stone-950 [&::-webkit-details-marker]:hidden"
              >
                <MoreHorizontal className="size-4" />
              </summary>
              <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-lg border border-stone-200 bg-white p-1 text-sm shadow-xl shadow-stone-950/10">
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="flex h-9 items-center gap-2 rounded-md px-2.5 font-medium text-stone-700 transition hover:bg-stone-100 hover:text-stone-950"
                >
                  <Eye className="size-4 text-stone-400" />
                  Ver detalle
                </Link>
                {canEdit ? (
                  <Link
                    href={`/admin/orders/${order.id}/edit`}
                    className="flex h-9 items-center gap-2 rounded-md px-2.5 font-medium text-stone-700 transition hover:bg-stone-100 hover:text-stone-950"
                  >
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

  return (
    <section className="min-w-0 rounded-lg border border-stone-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-stone-200 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-stone-500">
            {description ?? `${table.getFilteredRowModel().rows.length} ordenes visibles.`}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
          <select value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)} className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none">
            <option value="all">Todas las tiendas</option>
            <option value="LH">Leather House</option>
            <option value="LR">La Reina</option>
          </select>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none">
            <option value="all">Toda prioridad</option>
            <option value="critical">Crítica</option>
            <option value="high">Alta</option>
            <option value="normal">Normal</option>
          </select>
          <label className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Buscar cliente, código o producto"
              className="h-10 w-full rounded-md border border-stone-200 bg-stone-50 pl-9 pr-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
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
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              <X className="size-4" />
              Limpiar
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-stone-200 bg-stone-50">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-stone-500"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/70">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-middle text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {!table.getRowModel().rows.length ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-stone-500">
                  {emptyText}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-stone-200 px-4 py-3 text-xs text-stone-500">
        <span>Prioridad:</span>
        {Object.entries(priorityLabel).map(([key, label]) => (
          <span key={key} className="rounded-full border border-stone-200 bg-stone-50 px-2 py-1">
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
