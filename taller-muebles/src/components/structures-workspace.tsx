"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, ChevronDown, ChevronUp, CircleDot, ExternalLink, FileText, Hammer, LoaderCircle, Paperclip, Search, SquarePen } from "lucide-react";
import { saveStructureSpecification, setStructureOrderStatus } from "@/app/admin/structures/actions";
import type { StructureListRow } from "@/app/admin/structures/page";

type Filter = "all" | StructureListRow["structureStatus"];

const statusCopy = {
  unrequested: { label: "En blanco", className: "border-stone-200 bg-stone-50 text-stone-700" },
  requested: { label: "Pedida", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  in_progress: { label: "En estructura", className: "border-sky-200 bg-sky-50 text-sky-800" },
  done: { label: "Lista", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
};

export function StructuresWorkspace({ rows, canEdit }: { rows: StructureListRow[]; canEdit: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const normalizedQuery = query.trim().toLocaleLowerCase("es");
  const counts = useMemo(() => ({
    unrequested: rows.filter((row) => row.structureStatus === "unrequested").length,
    requested: rows.filter((row) => row.structureStatus === "requested").length,
    in_progress: rows.filter((row) => row.structureStatus === "in_progress").length,
    done: rows.filter((row) => row.structureStatus === "done").length,
  }), [rows]);
  const visibleRows = useMemo(() => rows.filter((row) => {
    if (filter !== "all" && row.structureStatus !== filter) return false;
    if (!normalizedQuery) return true;
    return [row.order.code, row.order.client, row.order.product, row.request?.specifications, row.request?.assignedTo]
      .filter(Boolean).join(" ").toLocaleLowerCase("es").includes(normalizedQuery);
  }), [filter, normalizedQuery, rows]);

  return (
    <>
      <header className="page-header">
        <div>
          <p className="page-kicker">Producción · Área estructura</p>
          <h1 className="page-title">Lista de estructuras</h1>
          <p className="page-description">Define cada estructura, asigna un responsable y controla su avance sin perder el vínculo con el pedido.</p>
        </div>
      </header>

      <section className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Metric label="En blanco" value={counts.unrequested} tone="stone" />
        <Metric label="Pedidas" value={counts.requested} tone="emerald" />
        <Metric label="En estructura" value={counts.in_progress} tone="sky" />
        <Metric label="Listas" value={counts.done} tone="emerald" />
      </section>

      <section className="panel mt-4 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-stone-200 p-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="control pl-9" placeholder="Buscar por pedido, cliente, producto o detalle…" />
          </label>
          <div className="flex gap-1 overflow-x-auto" aria-label="Filtrar estructuras por estado">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>Todas <b>{rows.length}</b></FilterButton>
            <FilterButton active={filter === "unrequested"} onClick={() => setFilter("unrequested")}>En blanco <b>{counts.unrequested}</b></FilterButton>
            <FilterButton active={filter === "requested"} onClick={() => setFilter("requested")}>Pedidas <b>{counts.requested}</b></FilterButton>
            <FilterButton active={filter === "in_progress"} onClick={() => setFilter("in_progress")}>En estructura <b>{counts.in_progress}</b></FilterButton>
            <FilterButton active={filter === "done"} onClick={() => setFilter("done")}>Listas <b>{counts.done}</b></FilterButton>
          </div>
        </div>

        <div className="divide-y divide-stone-100">
          {visibleRows.map((row) => <StructureCard key={row.order.id} row={row} canEdit={canEdit} />)}
          {!visibleRows.length ? (
            <div className="px-4 py-14 text-center">
              <Hammer className="mx-auto size-8 text-stone-300" />
              <p className="mt-3 text-sm font-semibold text-stone-800">No hay estructuras para mostrar</p>
              <p className="mt-1 text-sm text-stone-500">Prueba con otro texto o cambia el filtro de estado.</p>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

function StructureCard({ row, canEdit }: { row: StructureListRow; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const specification = row.request?.specifications || `01 · ${row.order.product}`;
  const status = statusCopy[row.structureStatus];

  return (
    <article className="p-3 transition hover:bg-stone-50/60 sm:p-4">
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(280px,1fr)_190px_250px] xl:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/admin/orders/${row.order.id}`} className="truncate font-mono text-base font-bold text-stone-950 hover:underline">{row.order.code}</Link>
            <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-600">{row.order.store}</span>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-stone-700">{row.order.client}</p>
          <p className="truncate text-xs text-stone-500">Entrega {formatDate(row.order.deliveryDate)}</p>
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">Detalle de estructura</p>
          <p className="mt-1 whitespace-pre-line text-sm font-semibold leading-5 text-stone-900">{specification}</p>
          <p className="mt-1 truncate text-xs text-stone-500">{row.request?.assignedTo ? `Responsable: ${row.request.assignedTo}` : "Sin responsable asignado"}</p>
        </div>

        <div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}>
            <CircleDot className="size-3" />{status.label}
          </span>
          <p className="mt-1.5 text-xs text-stone-500">
            {row.structureStatus === "unrequested"
              ? "Aún no solicitada al taller"
              : row.request
                ? `Actualizada ${formatDate(row.request.completedAt || row.request.requestedAt)}`
                : "Sin ficha técnica"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {row.request?.attachments[0] ? (
            <a href={row.request.attachments[0].url} target="_blank" rel="noreferrer" className="btn btn-secondary h-9" title={row.request.attachments[0].fileName}>
              <FileText className="size-4" /> Ver archivo
            </a>
          ) : null}
          <Link href={`/admin/orders/${row.order.id}`} className="grid size-9 place-items-center rounded-md border border-stone-200 bg-white text-stone-600 hover:bg-stone-100" title="Abrir pedido" aria-label={`Abrir pedido ${row.order.code}`}><ExternalLink className="size-4" /></Link>
          {canEdit ? (
            <button type="button" onClick={() => setEditing((value) => !value)} className="btn btn-secondary h-9" aria-expanded={editing}>
              <SquarePen className="size-4" /> Editar {editing ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          ) : null}
        </div>
      </div>

      {editing && canEdit ? (
        <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-3 sm:p-4">
          <form action={saveStructureSpecification} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <input type="hidden" name="orderId" value={row.order.id} />
            <input type="hidden" name="status" value={requestStatus(row.structureStatus)} />
            <label className="block">
              <span className="field-label">Detalle de la estructura</span>
              <textarea name="specifications" defaultValue={specification} required minLength={3} maxLength={1200} rows={3} className="textarea-control mt-1.5" placeholder="Ej: 02 sillones modelo Roma, madera seca, refuerzo central…" />
              <span className="mt-1 block text-xs text-stone-500">Puedes registrar varias unidades o modelos en líneas separadas.</span>
            </label>
            <div className="grid content-start gap-3">
              <label>
                <span className="field-label">Responsable</span>
                <input name="assignedTo" defaultValue={row.request?.assignedTo || ""} maxLength={80} className="control mt-1.5" placeholder="Nombre del maestro" />
              </label>
              <label className="btn btn-secondary h-10 cursor-pointer justify-start overflow-hidden">
                <Paperclip className="size-4 shrink-0" /><span className="truncate">Adjuntar plano o foto</span>
                <input name="file" type="file" accept="image/*,application/pdf" className="sr-only" />
              </label>
              <SubmitButton />
            </div>
          </form>
          <div className="mt-4 border-t border-stone-200 pt-3">
            <p className="field-label mb-2">Cambiar estado</p>
            <div className="flex flex-wrap gap-2">
              <StatusButton row={row} status="draft" label="En blanco" />
              <StatusButton row={row} status="requested" label="Pedida" />
              <StatusButton row={row} status="in_progress" label="En estructura" />
              <StatusButton row={row} status="done" label="Lista" />
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function StatusButton({ row, status, label }: { row: StructureListRow; status: "draft" | "requested" | "in_progress" | "done"; label: string }) {
  const active = requestStatus(row.structureStatus) === status;
  return (
    <form action={setStructureOrderStatus}>
      <input type="hidden" name="orderId" value={row.order.id} />
      <input type="hidden" name="specifications" value={row.request?.specifications || `01 · ${row.order.product}`} />
      <input type="hidden" name="status" value={status} />
      <button disabled={active} className={`btn h-9 ${active ? "border border-stone-900 bg-stone-900 text-white" : "btn-secondary"}`}>
        {status === "done" ? <Check className="size-4" /> : <CircleDot className="size-4" />}{label}
      </button>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="btn btn-primary h-10">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}{pending ? "Guardando…" : "Guardar cambios"}</button>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`shrink-0 rounded-md px-3 py-2 text-xs font-medium transition ${active ? "bg-stone-950 text-white" : "text-stone-600 hover:bg-stone-100"}`}>{children}</button>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "stone" | "amber" | "sky" | "emerald" }) {
  const tones = { stone: "border-stone-200 bg-stone-50", amber: "border-amber-200 bg-amber-50", sky: "border-sky-200 bg-sky-50", emerald: "border-emerald-200 bg-emerald-50" };
  return <div className={`rounded-lg border p-3 sm:p-4 ${tones[tone]}`}><p className="text-xl font-bold text-stone-950 sm:text-2xl">{value}</p><p className="mt-0.5 truncate text-xs font-medium text-stone-600 sm:text-sm">{label}</p></div>;
}

function requestStatus(status: StructureListRow["structureStatus"]) {
  return status === "unrequested" ? "draft" : status;
}

function formatDate(value: string) {
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short" }).format(date);
}
