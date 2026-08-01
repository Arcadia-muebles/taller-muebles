"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
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
  X,
  XCircle,
} from "lucide-react";
import {
  saveStructureSpecification,
  type StructureActionResult,
} from "@/app/admin/structures/actions";
import type { StructureListRow } from "@/app/admin/structures/page";

type Filter = "all" | StructureListRow["structureStatus"];

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
  const normalizedQuery = query.trim().toLocaleLowerCase("es");
  const counts = useMemo(
    () => ({
      unrequested: rows.filter((row) => row.structureStatus === "unrequested").length,
      requested: rows.filter((row) => row.structureStatus === "requested").length,
      in_progress: rows.filter((row) => row.structureStatus === "in_progress").length,
      done: rows.filter((row) => row.structureStatus === "done").length,
    }),
    [rows],
  );
  const visibleRows = useMemo(
    () =>
      rows.filter((row) => {
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
      }),
    [filter, normalizedQuery, rows],
  );

  return (
    <>
      <header className="page-header">
        <div>
          <p className="page-kicker">Taller de estructuras</p>
          <h1 className="page-title">Lista de estructuras</h1>
          <p className="page-description">
            Consulta, edita e imprime las especificaciones vinculadas a cada pedido.
          </p>
        </div>
        <button
          type="button"
          onClick={() => printStructures(visibleRows)}
          disabled={!visibleRows.length || loadError}
          className="btn btn-secondary print:hidden"
        >
          <Printer className="size-4" />
          Imprimir lista
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
        <div className="flex flex-col gap-3 border-b border-stone-200 p-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-md">
            <span className="sr-only">Buscar estructuras</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="control pl-9"
              placeholder="Buscar por código, cliente o descripción…"
            />
          </label>
          <div className="flex gap-1 overflow-x-auto" aria-label="Filtrar estructuras por estado">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>Todas <b>{rows.length}</b></FilterButton>
            <FilterButton active={filter === "unrequested"} onClick={() => setFilter("unrequested")}>En blanco <b>{counts.unrequested}</b></FilterButton>
            <FilterButton active={filter === "requested"} onClick={() => setFilter("requested")}>Pedidas <b>{counts.requested}</b></FilterButton>
            <FilterButton active={filter === "in_progress"} onClick={() => setFilter("in_progress")}>En estructura <b>{counts.in_progress}</b></FilterButton>
            <FilterButton active={filter === "done"} onClick={() => setFilter("done")}>Listas <b>{counts.done}</b></FilterButton>
          </div>
        </div>

        <div className="hidden grid-cols-[120px_130px_minmax(180px,1fr)_minmax(300px,1.6fr)_175px_90px] rounded-t-sm bg-stone-950 text-xs font-bold uppercase tracking-[0.08em] text-white lg:grid">
          <div className="px-4 py-4">Código</div>
          <div className="border-l border-white/15 px-4 py-4">Fecha</div>
          <div className="border-l border-white/15 px-4 py-4">Cliente</div>
          <div className="border-l border-white/15 px-4 py-4">Descripción</div>
          <div className="border-l border-white/15 px-4 py-4">Estado</div>
          <div className="border-l border-white/15 px-4 py-4 text-center">Acciones</div>
        </div>

        <div className="divide-y divide-stone-200">
          {visibleRows.map((row) => (
            <StructureRow key={row.order.id} row={row} canEdit={canEdit} />
          ))}
          {!visibleRows.length ? (
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
      <div className="grid gap-4 p-4 transition hover:bg-stone-50/70 lg:grid-cols-[120px_130px_minmax(180px,1fr)_minmax(300px,1.6fr)_175px_90px] lg:gap-0 lg:p-0">
        <div className="min-w-0 lg:px-4 lg:py-5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400 lg:hidden">Código</p>
          <Link href={`/admin/orders/${row.order.id}`} className="font-mono text-base font-bold text-stone-950 hover:underline">
            {row.order.code}
          </Link>
          <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-600 lg:hidden">{row.order.store}</span>
        </div>

        <div className="min-w-0 lg:border-l lg:border-stone-200 lg:px-4 lg:py-5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400 lg:hidden">Fecha</p>
          <time className="text-sm font-medium text-stone-700" dateTime={row.order.entryDate}>{formatDate(row.order.entryDate)}</time>
        </div>

        <div className="min-w-0 lg:border-l lg:border-stone-200 lg:px-4 lg:py-5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400 lg:hidden">Cliente</p>
          <p className="text-sm font-semibold leading-5 text-stone-900">{row.order.client}</p>
          <p className="mt-1 text-xs text-stone-500">{row.order.store} · Entrega {formatDate(row.order.deliveryDate)}</p>
        </div>

        <div className="min-w-0 lg:border-l lg:border-stone-200 lg:px-4 lg:py-5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400 lg:hidden">Descripción</p>
          <p className="whitespace-pre-wrap break-words text-sm font-medium leading-5 text-stone-900">{specification}</p>
          {row.request?.assignedTo ? <p className="mt-1.5 text-xs text-stone-500">Responsable: {row.request.assignedTo}</p> : null}
        </div>

        <div className="min-w-0 lg:border-l lg:border-stone-200 lg:px-4 lg:py-5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400 lg:hidden">Estado</p>
          <span className={`inline-flex min-w-32 items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-bold uppercase tracking-[0.03em] ${status.className}`}>
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

        <div className="flex items-start lg:justify-center lg:border-l lg:border-stone-200 lg:px-3 lg:py-5">
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
  return (
    <details className="group relative z-10">
      <summary className="grid size-10 list-none place-items-center rounded-md border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-100 [&::-webkit-details-marker]:hidden" aria-label={`Acciones de ${row.order.code}`}>
        <MoreVertical className="size-5" />
      </summary>
      <div className="absolute left-0 top-12 z-30 w-52 rounded-lg border border-stone-200 bg-white p-1.5 shadow-xl shadow-stone-950/10 lg:left-auto lg:right-0">
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

      <form action={action} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_220px]">
        <input type="hidden" name="orderId" value={row.order.id} />
        {row.request ? <input type="hidden" name="requestId" value={row.request.id} /> : null}
        {!row.request ? <input type="hidden" name="expectNoRequest" value="1" /> : null}
        {row.request?.updatedAt ? <input type="hidden" name="expectedUpdatedAt" value={row.request.updatedAt} /> : null}
        <label className="block xl:row-span-3">
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

        <div className="flex flex-col gap-2 xl:col-span-2 xl:flex-row xl:items-center xl:justify-between">
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
        @page { size: landscape; margin: 12mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #1c1917; font: 11px Arial, Helvetica, sans-serif; }
        header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 18px; border-bottom: 2px solid #1c1917; padding-bottom: 12px; }
        h1 { margin: 0; font-size: 25px; letter-spacing: -.02em; text-transform: uppercase; }
        header p { margin: 4px 0 0; color: #57534e; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; }
        header strong { font: 22px Georgia, serif; letter-spacing: .12em; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
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
