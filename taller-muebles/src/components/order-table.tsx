"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Eye, MessageSquareWarning, MoreHorizontal, Paperclip, Pencil, Search, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { completionPercent } from "@/lib/metrics";
import type { Order } from "@/lib/types";
import { cn, deliveryLabel, formatDate, hasMeaningfulObservations, priorityLabel } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

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

export function OrderTable({
  orders,
  canEditOrders = false,
  rowLinks = false,
  hideActions = false,
  detailPathPrefix = "/admin/orders",
  title = "Órdenes de producción",
  description,
  emptyText = "No hay órdenes que coincidan con los filtros.",
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
            Código
            <ArrowUpDown className="size-3.5" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            {rowLinks ? (
              <span className="truncate font-mono text-sm font-semibold underline-offset-4 group-hover:underline">
                {row.original.code}
              </span>
            ) : (
              <Link href={`${detailPathPrefix}/${row.original.id}`} className="truncate font-mono text-sm font-semibold underline-offset-4 hover:underline">
                {row.original.code}
              </Link>
            )}
            {row.original.isWarranty ? <ShieldCheck className="size-4 shrink-0 text-violet-600" /> : null}
            {hasMeaningfulObservations(row.original.observations) ? (
              <MessageSquareWarning className="size-4 shrink-0 text-amber-600" aria-label="Tiene observaciones" />
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "groupCode",
        header: "Pedido",
        cell: ({ row }) => (
          <span className="inline-flex max-w-full rounded-md border border-stone-200 bg-stone-50 px-2 py-1 font-mono text-xs font-semibold text-stone-700">
            <span className="truncate">{row.original.groupCode}</span>
          </span>
        ),
      },
      {
        accessorKey: "client",
        header: "Cliente",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-stone-950">{row.original.client}</p>
            <p className="text-xs text-stone-500">{row.original.store}</p>
          </div>
        ),
      },
      {
        accessorKey: "product",
        header: "Producto",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.product}</p>
            <p className="truncate text-xs text-stone-500">
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
        header: "Resp.",
        cell: ({ row }) => (
          <span className="inline-flex max-w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium">
            <span className="truncate">{row.original.assignedTo}</span>
          </span>
        ),
      },
      {
        accessorKey: "deliveryDate",
        header: ({ column }) => (
          <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Entrega
            <ArrowUpDown className="size-3.5" />
          </button>
        ),
        cell: ({ row }) => {
          const isCompleted = row.original.status === "completed";
          const label = deliveryLabel(row.original.deliveryDate, isCompleted);
          const isRisk = !isCompleted && (label.startsWith("Vencido") || label === "Hoy" || label === "Mañana");
          return (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{formatDate(row.original.deliveryDate)}</p>
              <p className={cn("truncate text-xs font-semibold", isRisk ? "text-rose-600" : "text-stone-500")}>{label}</p>
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
            <div className="min-w-0">
              <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${value}%` }} />
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
          <div className="flex min-w-0 items-center gap-2 text-xs text-stone-600">
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
        },
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
    <section className="panel max-w-full">
      <div className="panel-header flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="panel-title">{title}</h2>
          <p className="panel-description">{description ?? `${table.getFilteredRowModel().rows.length} órdenes visibles.`}</p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 md:w-auto md:flex-row md:flex-wrap md:justify-end">
          <select value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)} className="control min-w-0 bg-white text-stone-700">
            <option value="all">Todas las tiendas</option>
            <option value="LH">Leather House</option>
            <option value="LR">La Reina</option>
          </select>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="control min-w-0 bg-white text-stone-700">
            <option value="all">Toda urgencia</option>
            <option value="critical">Crítica</option>
            <option value="high">Alta</option>
            <option value="normal">Normal</option>
          </select>
          <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className="control min-w-0 bg-white text-stone-700">
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

      <div className="grid gap-3 p-3 xl:hidden">
        {visibleRows.map((row) => (
          <OrderCard key={row.id} order={row.original} canEditOrders={canEditOrders} rowLinks={rowLinks} hideActions={hideActions} detailPathPrefix={detailPathPrefix} />
        ))}
        {!visibleRows.length ? (
          <div className="empty-state">{emptyText}</div>
        ) : null}
      </div>

      <div className="hidden min-w-0 xl:block">
        <table className="w-full table-fixed border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-stone-200 bg-stone-50">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} className={cn("border-b border-stone-100 last:border-0 hover:bg-stone-50/70", rowLinks && "group cursor-pointer")}>
                {row.getVisibleCells().map((cell) => (
                  rowLinks ? (
                    <td key={cell.id} className="min-w-0 p-0 align-middle text-sm">
                      <Link href={`${detailPathPrefix}/${row.original.id}`} className="block min-h-14 px-3 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Link>
                    </td>
                  ) : (
                    <td key={cell.id} className="min-w-0 px-3 py-3 align-middle text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                ))}
              </tr>
            ))}
            {!visibleRows.length ? (
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
    <article className={cn("min-w-0 rounded-lg border border-stone-200 bg-stone-50 p-3", rowLinks && "group cursor-pointer hover:bg-stone-100")}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {rowLinks ? (
              <span className="min-w-0 truncate font-mono text-sm font-semibold underline-offset-4 group-hover:underline">
                {order.code}
              </span>
            ) : (
              <Link href={`${detailPathPrefix}/${order.id}`} className="min-w-0 truncate font-mono text-sm font-semibold underline-offset-4 hover:underline">
                {order.code}
              </Link>
            )}
            {order.isWarranty ? <ShieldCheck className="size-4 shrink-0 text-violet-600" /> : null}
            {hasMeaningfulObservations(order.observations) ? (
              <MessageSquareWarning className="size-4 shrink-0 text-amber-600" aria-label="Tiene observaciones" />
            ) : null}
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-stone-950">{order.client}</p>
          <p className="mt-1 truncate font-mono text-xs font-semibold text-stone-500">Pedido {order.groupCode}</p>
          <p className="mt-1 line-clamp-2 text-sm text-stone-600">{order.product}</p>
          <p className="mt-1 truncate text-xs text-stone-500">
            {order.material} / {order.color}
          </p>
        </div>
        <StatusBadge type="order" value={order.status} />
      </div>

      <div className="mt-3 grid gap-2 text-xs text-stone-600 sm:grid-cols-3">
        <Info label="Responsable" value={order.assignedTo} />
        <Info label="Entrega" value={`${formatDate(order.deliveryDate)} · ${deliveryLabel(order.deliveryDate, order.status === "completed")}`} />
        <div className="min-w-0 rounded-md border border-stone-200 bg-white p-2">
          <p className="font-medium uppercase tracking-[0.12em] text-stone-400">Avance</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 font-semibold text-stone-700">{progress}%</p>
        </div>
      </div>

      {order.observations ? <p className="mt-3 line-clamp-2 text-xs leading-5 text-stone-500">{order.observations}</p> : null}

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
