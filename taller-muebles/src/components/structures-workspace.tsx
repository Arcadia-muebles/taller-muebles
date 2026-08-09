"use client";

import Link from "next/link";
import { useActionState, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock3,
  ExternalLink,
  FileText,
  Hammer,
  LoaderCircle,
  MoreVertical,
  Paperclip,
  Pencil,
  Printer,
  Search,
  Settings2,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import {
  removeStructureFromList,
  saveStructureSpecification,
  type StructureActionResult,
} from "@/app/admin/structures/actions";
import type { StructureListRow } from "@/app/admin/structures/page";

type Filter = "all" | StructureListRow["structureStatus"];
type Sort = "workflow" | "delivery" | "newest" | "code";

const structuresPerPage = 20;

const statusCopy = {
  unrequested: {
    label: "En blanco",
    className: "border-stone-300 bg-stone-100 text-stone-700",
    icon: Circle,
  },
  requested: {
    label: "Pedida",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Clock3,
  },
  in_progress: {
    label: "En estructura",
    className: "border-blue-200 bg-blue-600 text-white",
    icon: Settings2,
  },
  done: {
    label: "Lista",
    className: "border-emerald-200 bg-emerald-600 text-white",
    icon: CheckCircle2,
  },
};

const initialActionState: StructureActionResult = { ok: false, message: "" };

export function StructuresWorkspace({
  rows,
  canEdit,
  loadError,
}: {
  rows: StructureListRow[];
  canEdit: boolean;
  loadError: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("workflow");
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLocaleLowerCase("es");
  const counts = useMemo(
    () => ({
      unrequested: rows.filter((row) => row.structureStatus === "unrequested").length,
      requested: rows.filter((row) => row.structureStatus === "requested").length,
      in_progress: rows.filter((row) => row.structureStatus === "in_progress").length,
      done: rows.filter((row) => row.structureStatus === "done").length,
    }),
    [rows],
  );
  const filteredRows = useMemo(
    () => {
      const matches = rows.filter((row) => {
        if (filter !== "all" && row.structureStatus !== filter) return false;
        if (!normalizedQuery) return true;
        return [
          row.order.code,
          row.order.client,
          row.order.product,
          row.request?.specifications,
          row.request?.assignedTo,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("es")
          .includes(normalizedQuery);
      });
      return sort === "workflow"
        ? matches
        : matches.toSorted((a, b) => sortStructureRows(a, b, sort));
    },
    [filter, normalizedQuery, rows, sort],
  );
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / structuresPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(
    () => filteredRows.slice((currentPage - 1) * structuresPerPage, currentPage * structuresPerPage),
    [currentPage, filteredRows],
  );
  const pageNumbers = useMemo(() => visiblePageNumbers(currentPage, totalPages), [currentPage, totalPages]);

  function chooseFilter(nextFilter: Filter) {
    setFilter(nextFilter);
    setPage(1);
  }

  function clearFilters() {
    setQuery("");
    setFilter("all");
    setSort("workflow");
    setPage(1);
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="page-kicker">Taller de estructuras</p>
          <h1 className="page-title">Lista de estructuras</h1>
          <p className="page-description">
            Busca, prioriza y administra las especificaciones vinculadas a cada pedido.
          </p>
        </div>
        <button
          type="button"
          onClick={() => printStructures(filteredRows)}
          disabled={!filteredRows.length || loadError}
          className="btn btn-secondary print:hidden"
        >
          <Printer className="size-4" />
          Imprimir resultados
        </button>
      </header>

      {loadError ? (
        <div role="alert" className="mt-5 flex gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-900">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">No pudimos cargar las fichas guardadas en Supabase.</p>
            <p className="mt-1 text-sm text-rose-700">
              La edición quedó bloqueada para no reemplazar información real. Recarga la página o revisa la conexión.
            </p>
          </div>
        </div>
      ) : null}

      <section className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Metric label="En blanco" value={counts.unrequested} tone="stone" />
        <Metric label="Pedidas" value={counts.requested} tone="amber" />
        <Metric label="En estructura" value={counts.in_progress} tone="blue" />
        <Metric label="Listas" value={counts.done} tone="emerald" />
      </section>

      <section className="panel mt-4 overflow-visible">
        <div className="sticky top-[69px] z-20 space-y-3 border-b border-stone-200 bg-white/95 p-3 backdrop-blur lg:top-0">
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative block min-w-0">
              <span className="sr-only">Buscar estructuras</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                className="control pl-9"
                placeholder="Código, cliente, producto o descripción…"
                autoComplete="off"
              />
            </label>
            <label className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
              <span className="text-xs font-semibold text-stone-500">Ordenar</span>
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as Sort);
                  setPage(1);
                }}
                className="control"
                aria-label="Ordenar estructuras"
              >
                <option value="workflow">Prioridad de trabajo</option>
                <option value="delivery">Entrega más próxima</option>
                <option value="newest">Ingreso más reciente</option>
                <option value="code">Código</option>
              </select>
            </label>
          </div>
          <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0" aria-label="Filtrar estructuras por estado">
              <FilterButton active={filter === "all"} onClick={() => chooseFilter("all")}>Todas <b>{rows.length}</b></FilterButton>
              <FilterButton active={filter === "unrequested"} onClick={() => chooseFilter("unrequested")}>En blanco <b>{counts.unrequested}</b></FilterButton>
              <FilterButton active={filter === "requested"} onClick={() => chooseFilter("requested")}>Pedidas <b>{counts.requested}</b></FilterButton>
              <FilterButton active={filter === "in_progress"} onClick={() => chooseFilter("in_progress")}>En estructura <b>{counts.in_progress}</b></FilterButton>
              <FilterButton active={filter === "done"} onClick={() => chooseFilter("done")}>Listas <b>{counts.done}</b></FilterButton>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 text-xs text-stone-500 md:justify-end">
              <span aria-live="polite">{filteredRows.length} {filteredRows.length === 1 ? "resultado" : "resultados"}</span>
              {query || filter !== "all" || sort !== "workflow" ? (
                <button type="button" onClick={clearFilters} className="font-semibold text-stone-700 underline-offset-4 hover:underline">
                  Limpiar
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="hidden grid-cols-[120px_110px_minmax(170px,0.9fr)_minmax(260px,1.5fr)_160px_72px] rounded-t-sm bg-stone-950 text-xs font-bold uppercase tracking-[0.08em] text-white xl:grid">
          <div className="px-3 py-3">Código</div>
          <div className="border-l border-white/15 px-3 py-3">Ingreso</div>
          <div className="border-l border-white/15 px-3 py-3">Cliente</div>
          <div className="border-l border-white/15 px-3 py-3">Descripción</div>
          <div className="border-l border-white/15 px-3 py-3">Estado</div>
          <div className="border-l border-white/15 px-3 py-3 text-center">Acciones</div>
        </div>

        <div className="divide-y divide-stone-200">
          {paginatedRows.map((row) => (
            <StructureRow key={row.order.id} row={row} canEdit={canEdit} />
          ))}
          {!filteredRows.length ? (
            <div className="px-4 py-14 text-center">
              {loadError ? <AlertTriangle className="mx-auto size-8 text-rose-300" /> : <Hammer className="mx-auto size-8 text-stone-300" />}
              <p className="mt-3 text-sm font-semibold text-stone-800">
                {loadError ? "La información no está disponible" : "No hay estructuras para mostrar"}
              </p>
              <p className="mt-1 text-sm text-stone-500">
                {loadError ? "No interpretaremos un error de conexión como una lista vacía." : "Prueba con otro texto o cambia el filtro de estado."}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-stone-200 px-3 py-3 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <span>{paginationLabel(filteredRows.length, currentPage)}</span>
          {totalPages > 1 ? (
            <nav className="flex max-w-full items-center gap-1 overflow-x-auto pb-1 sm:pb-0" aria-label="Paginación de estructuras">
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} className="pagination-button">
                Anterior
              </button>
              {pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  aria-current={pageNumber === currentPage ? "page" : undefined}
                  className={`pagination-button min-w-8 ${pageNumber === currentPage ? "border-stone-950 bg-stone-950 text-white" : ""}`}
                >
                  {pageNumber}
                </button>
              ))}
              <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages} className="pagination-button">
                Siguiente
              </button>
            </nav>
          ) : null}
        </div>
      </section>

      {!loadError ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-stone-500">
          <span className="font-semibold uppercase tracking-[0.08em] text-stone-700">Leyenda</span>
          {Object.entries(statusCopy).map(([key, status]) => {
            const Icon = status.icon;
            return <span key={key} className="inline-flex items-center gap-1.5"><Icon className="size-3.5" />{status.label}</span>;
          })}
          <span className="inline-flex items-center gap-1.5"><MoreVertical className="size-3.5" /> Abre las acciones de cada ficha</span>
        </div>
      ) : null}
    </>
  );
}

function StructureRow({ row, canEdit }: { row: StructureListRow; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const specification = row.request?.specifications || `01 · ${row.order.product}`;
  const status = statusCopy[row.structureStatus];
  const StatusIcon = status.icon;

  return (
    <article className={row.syncWarning ? "bg-amber-50/40" : "bg-white"}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-3 p-4 transition hover:bg-stone-50/70 md:grid-cols-[minmax(0,1fr)_170px_52px] md:gap-x-4 min-[900px]:grid-cols-[220px_minmax(0,1fr)_160px_52px] min-[900px]:py-3.5 xl:grid-cols-[120px_110px_minmax(170px,0.9fr)_minmax(260px,1.5fr)_160px_72px] xl:gap-0 xl:p-0">
        <div className="min-w-0 md:col-start-1 md:row-start-1 min-[900px]:col-start-1 min-[900px]:row-start-1 xl:col-auto xl:row-auto xl:px-3 xl:py-3.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400 xl:hidden">Nota de venta</p>
          <Link href={`/admin/orders/${row.order.id}`} className="font-mono text-base font-bold text-stone-950 hover:underline">
            {row.order.code}
          </Link>
          <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-600 xl:hidden">{row.order.store}</span>
          <p className="mt-1 truncate text-sm font-semibold text-stone-900 xl:hidden">{row.order.client}</p>
          <p className="mt-1 text-xs text-stone-500 xl:hidden">
            Ingreso {formatDate(row.order.entryDate)} · Entrega {formatDate(row.order.deliveryDate)}
          </p>
        </div>

        <div className="hidden min-w-0 xl:block xl:border-l xl:border-stone-200 xl:px-3 xl:py-3.5">
          <time className="text-sm font-medium text-stone-700" dateTime={row.order.entryDate}>{formatDate(row.order.entryDate)}</time>
        </div>

        <div className="hidden min-w-0 xl:block xl:border-l xl:border-stone-200 xl:px-3 xl:py-3.5">
          <p className="text-sm font-semibold leading-5 text-stone-900">{row.order.client}</p>
          <p className="mt-1 text-xs text-stone-500">{row.order.store} · Entrega {formatDate(row.order.deliveryDate)}</p>
        </div>

        <div className="col-span-2 min-w-0 md:col-span-1 md:col-start-1 md:row-start-2 min-[900px]:col-start-2 min-[900px]:row-start-1 xl:col-auto xl:row-auto xl:border-l xl:border-stone-200 xl:px-3 xl:py-3.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400 xl:hidden">Descripción</p>
          <p title={specification} className="line-clamp-3 whitespace-pre-wrap break-words text-sm font-medium leading-5 text-stone-900 xl:line-clamp-2">{specification}</p>
          {row.request?.assignedTo ? <p className="mt-1.5 text-xs text-stone-500">Responsable: {row.request.assignedTo}</p> : null}
        </div>

        <div className="col-span-2 min-w-0 md:col-span-1 md:col-start-2 md:row-span-2 md:row-start-1 min-[900px]:col-start-3 min-[900px]:row-span-1 min-[900px]:row-start-1 xl:col-auto xl:row-auto xl:border-l xl:border-stone-200 xl:px-3 xl:py-3.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400 xl:hidden">Estado</p>
          <span className={`inline-flex min-w-32 items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-bold uppercase tracking-[0.03em] md:w-full ${status.className}`}>
            <StatusIcon className={`size-4 ${row.structureStatus === "in_progress" ? "animate-[spin_4s_linear_infinite]" : ""}`} />
            {status.label}
          </span>
          {row.syncWarning ? (
            <p className="mt-2 flex items-start gap-1 text-xs font-medium text-amber-800" title="La solicitud y el paso productivo muestran estados distintos.">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> Revisar sincronización
            </p>
          ) : row.request ? (
            <p className="mt-2 text-xs text-stone-500">Actualizada {formatDate(row.request.updatedAt || row.request.completedAt || row.request.requestedAt)}</p>
          ) : (
            <p className="mt-2 text-xs text-stone-500">Sin ficha guardada</p>
          )}
        </div>

        <div className="col-start-2 row-start-1 flex items-start justify-end md:col-start-3 md:row-start-1 min-[900px]:col-start-4 min-[900px]:row-start-1 xl:col-auto xl:row-auto xl:justify-center xl:border-l xl:border-stone-200 xl:px-2 xl:py-3.5">
          <StructureActions row={row} canEdit={canEdit} onEdit={() => setEditing(true)} />
        </div>
      </div>

      {editing && canEdit ? (
        <StructureEditor row={row} specification={specification} onClose={() => setEditing(false)} />
      ) : null}
    </article>
  );
}

function StructureActions({
  row,
  canEdit,
  onEdit,
}: {
  row: StructureListRow;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [removeState, removeAction, removePending] = useActionState(
    removeStructureFromList,
    initialActionState,
  );

  useEffect(() => {
    function closeOnOutsidePress(event: PointerEvent) {
      const details = detailsRef.current;
      if (details?.open && event.target instanceof Node && !details.contains(event.target)) {
        details.open = false;
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      const details = detailsRef.current;
      if (event.key !== "Escape" || !details?.open) return;
      details.open = false;
      details.querySelector("summary")?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <details ref={detailsRef} name="structure-actions" className="group relative z-10">
      <summary className="grid size-10 list-none place-items-center rounded-md border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-100 [&::-webkit-details-marker]:hidden" aria-label={`Acciones de ${row.order.code}`}>
        <MoreVertical className="size-5" />
      </summary>
      <div className="absolute right-0 top-12 z-30 w-64 rounded-lg border border-stone-200 bg-white p-1.5 shadow-xl shadow-stone-950/10">
        <Link href={`/admin/orders/${row.order.id}`} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-50">
          <ExternalLink className="size-4" /> Ver pedido
        </Link>
        {canEdit ? (
          <button
            type="button"
            onClick={(event) => {
              onEdit();
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm text-stone-700 hover:bg-stone-50"
          >
            <Pencil className="size-4" /> Editar descripción
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => printStructures([row])}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm text-stone-700 hover:bg-stone-50"
        >
          <Printer className="size-4" /> Imprimir ficha
        </button>
        {row.request?.attachments[0] ? (
          <a href={row.request.attachments[0].url} target="_blank" rel="noreferrer" className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-50">
            <FileText className="size-4" /> Abrir adjunto
          </a>
        ) : null}
        {canEdit ? (
          <form
            action={removeAction}
            onSubmit={(event) => {
              const confirmed = window.confirm(
                `¿Quitar la nota ${row.order.code} de la lista de estructuras?\n\nÚsalo sólo si este producto no necesita estructura. La orden y el historial se conservarán.`,
              );
              if (!confirmed) event.preventDefault();
            }}
            className="mt-1 border-t border-stone-200 pt-1"
          >
            <input type="hidden" name="orderId" value={row.order.id} />
            {row.request ? <input type="hidden" name="requestId" value={row.request.id} /> : null}
            {!row.request ? <input type="hidden" name="expectNoRequest" value="1" /> : null}
            {row.request?.updatedAt ? <input type="hidden" name="expectedUpdatedAt" value={row.request.updatedAt} /> : null}
            <button
              type="submit"
              disabled={removePending}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
            >
              {removePending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {removePending ? "Eliminando…" : "Eliminar de la lista"}
            </button>
            {removeState.message && !removeState.ok ? (
              <p role="alert" className="px-3 pb-2 text-xs leading-4 text-rose-700">{removeState.message}</p>
            ) : null}
          </form>
        ) : null}
      </div>
    </details>
  );
}

function StructureEditor({
  row,
  specification,
  onClose,
}: {
  row: StructureListRow;
  specification: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(saveStructureSpecification, initialActionState);

  return (
    <div className="border-t border-stone-200 bg-stone-50 p-4 lg:px-5 lg:py-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-950">Editar ficha · {row.order.code}</p>
          <p className="mt-1 text-xs text-stone-500">Al guardar, la descripción queda vinculada al pedido y registrada en auditoría.</p>
        </div>
        <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-md text-stone-500 hover:bg-stone-200" aria-label="Cerrar edición">
          <X className="size-4" />
        </button>
      </div>

      <form action={action} className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_220px]">
        <input type="hidden" name="orderId" value={row.order.id} />
        {row.request ? <input type="hidden" name="requestId" value={row.request.id} /> : null}
        {!row.request ? <input type="hidden" name="expectNoRequest" value="1" /> : null}
        {row.request?.updatedAt ? <input type="hidden" name="expectedUpdatedAt" value={row.request.updatedAt} /> : null}
        <label className="block md:col-span-2 xl:col-span-1 xl:row-span-3">
          <span className="field-label">Descripción de la estructura</span>
          <textarea
            name="specifications"
            defaultValue={specification}
            required
            minLength={3}
            maxLength={1200}
            rows={7}
            className="textarea-control mt-1.5 min-h-40 resize-y"
            placeholder="Ej.: 02 sillones modelo Roma, madera seca, refuerzo central…"
          />
          <span className="mt-1.5 block text-xs text-stone-500">Admite varias unidades, medidas o modelos en líneas separadas.</span>
        </label>

        <label>
          <span className="field-label">Estado</span>
          <select name="status" defaultValue={requestStatus(row.structureStatus)} className="control mt-1.5">
            <option value="draft">En blanco</option>
            <option value="requested">Pedida</option>
            <option value="in_progress">En estructura</option>
            <option value="done">Lista</option>
          </select>
        </label>

        <label>
          <span className="field-label">Responsable</span>
          <input name="assignedTo" defaultValue={row.request?.assignedTo || ""} maxLength={80} className="control mt-1.5" placeholder="Nombre del maestro" />
        </label>

        <label className="btn btn-secondary h-10 cursor-pointer justify-start overflow-hidden">
          <Paperclip className="size-4 shrink-0" />
          <span className="truncate">Adjuntar imagen o PDF</span>
          <input name="file" type="file" accept="image/*,application/pdf" className="sr-only" />
        </label>

        <div className="flex flex-col gap-2 md:col-span-2 xl:flex-row xl:items-center xl:justify-between">
          <ActionFeedback state={state} />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={pending} className="btn btn-secondary">Cancelar</button>
            <button disabled={pending} className="btn btn-primary min-w-40">
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ActionFeedback({ state }: { state: StructureActionResult }) {
  if (!state.message) return <p className="text-xs text-stone-500">No se reemplazarán cambios guardados por otra persona.</p>;
  const Icon = state.ok ? CheckCircle2 : XCircle;
  return (
    <p aria-live="polite" className={`inline-flex items-start gap-1.5 text-xs font-medium ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      {state.message}
    </p>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`shrink-0 rounded-md px-3 py-2 text-xs font-medium transition ${active ? "bg-stone-950 text-white" : "text-stone-600 hover:bg-stone-100"}`}>{children}</button>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "stone" | "amber" | "blue" | "emerald" }) {
  const tones = {
    stone: "border-stone-200 bg-stone-50",
    amber: "border-amber-200 bg-amber-50",
    blue: "border-blue-200 bg-blue-50",
    emerald: "border-emerald-200 bg-emerald-50",
  };
  return <div className={`rounded-lg border p-3 sm:p-4 ${tones[tone]}`}><p className="text-xl font-bold text-stone-950 sm:text-2xl">{value}</p><p className="mt-0.5 truncate text-xs font-medium text-stone-600 sm:text-sm">{label}</p></div>;
}

function requestStatus(status: StructureListRow["structureStatus"]) {
  return status === "unrequested" ? "draft" : status;
}

function formatDate(value: string) {
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function sortStructureRows(a: StructureListRow, b: StructureListRow, sort: Exclude<Sort, "workflow">) {
  if (sort === "delivery") {
    return a.order.deliveryDate.localeCompare(b.order.deliveryDate) || a.order.code.localeCompare(b.order.code);
  }
  if (sort === "newest") {
    return b.order.entryDate.localeCompare(a.order.entryDate) || a.order.code.localeCompare(b.order.code);
  }
  return a.order.code.localeCompare(b.order.code, "es", { numeric: true });
}

function paginationLabel(total: number, currentPage: number) {
  if (!total) return "Mostrando 0 estructuras";
  const from = (currentPage - 1) * structuresPerPage + 1;
  const to = Math.min(currentPage * structuresPerPage, total);
  return `Mostrando ${from}-${to} de ${total} estructuras`;
}

function visiblePageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const start = Math.min(Math.max(currentPage - 2, 1), totalPages - 4);
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function printStructures(rows: StructureListRow[]) {
  if (!rows.length) return;
  const frame = document.createElement("iframe");
  frame.title = rows.length === 1 ? `Ficha ${rows[0].order.code}` : "Lista de estructuras";
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
  printDocument.write(structuresPrintDocument(rows));
  printDocument.close();

  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
  }, 250);
}

function structuresPrintDocument(rows: StructureListRow[]) {
  const title = rows.length === 1 ? `Ficha de estructura · ${rows[0].order.code}` : "Lista de estructuras";
  const body = rows.map((row) => {
    const description = row.request?.specifications || `01 · ${row.order.product}`;
    return `<tr>
      <td class="code">${escapeHtml(row.order.code)}</td>
      <td>${escapeHtml(formatDate(row.order.entryDate))}</td>
      <td><strong>${escapeHtml(row.order.client)}</strong><small>${escapeHtml(row.order.store)}</small></td>
      <td class="description">${escapeHtml(description)}</td>
      <td><span class="status status-${escapeHtml(row.structureStatus)}">${escapeHtml(statusCopy[row.structureStatus].label)}</span></td>
    </tr>`;
  }).join("");

  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        @page { size: letter landscape; margin: 10mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #1c1917; font: 11px Arial, Helvetica, sans-serif; }
        header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 18px; border-bottom: 2px solid #1c1917; padding-bottom: 12px; }
        h1 { margin: 0; font-size: 25px; letter-spacing: -.02em; text-transform: uppercase; }
        header p { margin: 4px 0 0; color: #57534e; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; }
        header strong { font: 22px Georgia, serif; letter-spacing: .12em; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        thead { display: table-header-group; }
        tr { break-inside: avoid; page-break-inside: avoid; }
        th { background: #1c1917; color: white; padding: 10px 9px; text-align: left; text-transform: uppercase; }
        td { border: 1px solid #d6d3d1; padding: 10px 9px; vertical-align: top; }
        th:nth-child(1) { width: 12%; } th:nth-child(2) { width: 12%; } th:nth-child(3) { width: 22%; } th:nth-child(4) { width: 38%; } th:nth-child(5) { width: 16%; }
        .code { font-weight: 700; font-size: 13px; }
        .description { white-space: pre-wrap; line-height: 1.4; }
        small { display: block; margin-top: 3px; color: #78716c; }
        .status { display: inline-block; border-radius: 4px; padding: 5px 7px; font-weight: 700; text-transform: uppercase; }
        .status-unrequested { background: #e7e5e4; } .status-requested { background: #fef3c7; }
        .status-in_progress { background: #2563eb; color: white; } .status-done { background: #16a34a; color: white; }
        footer { margin-top: 10px; color: #78716c; font-size: 9px; text-align: right; }
      </style>
    </head>
    <body>
      <header><div><h1>${escapeHtml(title)}</h1><p>Taller de estructuras</p></div><strong>LA REINA</strong></header>
      <table>
        <thead><tr><th>Código</th><th>Fecha</th><th>Cliente</th><th>Descripción</th><th>Estado</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      <footer>Impreso ${escapeHtml(new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(new Date()))}</footer>
    </body>
  </html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}
