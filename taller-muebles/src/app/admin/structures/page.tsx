import { CheckSquare, Paperclip, Pencil, Square } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { saveStructureSpecification, setStructureOrderStatus } from "@/app/admin/structures/actions";
import { requireSession } from "@/lib/auth";
import { activeOrders } from "@/lib/metrics";
import { listOrders, listStructureRequests } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import type { Order, StructureRequest } from "@/lib/types";

type StructureListRow = {
  order: Order;
  request?: StructureRequest;
  structureStatus: "pending" | "in_progress" | "done";
};

export default async function StructuresPage() {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const [orders, requests, settings] = await Promise.all([listOrders(), listStructureRequests(), getSystemSettings()]);
  const canEdit = user.role === "admin" || (user.role === "manager" && settings.permissions.managersCanEditOrders);
  const rows = buildRows(orders, requests);

  return (
    <AppShell active="admin" user={user}>
      <header className="page-header">
        <div>
          <h1 className="page-title">Lista de estructuras</h1>
          <p className="page-description">Especificaciones para el área de estructura.</p>
        </div>
      </header>

      <section className="panel mt-5 overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[980px] table-fixed">
            <colgroup>
              <col className="w-[210px]" />
              <col />
              <col className="w-[230px]" />
              <col className="w-[95px]" />
            </colgroup>
            <thead className="table-head">
              <tr>
                <th className="px-3 py-2">Pedido</th>
                <th className="px-3 py-2">Especificación</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <StructureRow key={row.order.id} row={row} canEdit={canEdit} />
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-stone-500">No hay pedidos activos con etapa de estructura.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="grid gap-2 p-2 md:hidden">
          {rows.map((row) => (
            <StructureMobileRow key={row.order.id} row={row} canEdit={canEdit} />
          ))}
          {!rows.length ? <div className="empty-state">No hay pedidos activos con etapa de estructura.</div> : null}
        </div>
      </section>
    </AppShell>
  );
}

function buildRows(orders: Order[], requests: StructureRequest[]): StructureListRow[] {
  const requestByOrderId = new Map(requests.map((request) => [request.orderId, request]));
  return activeOrders(orders)
    .filter((order) => order.steps.some((step) => step.key === "structure"))
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((order) => ({ order, request: requestByOrderId.get(order.id), structureStatus: structureStatusFromOrder(order) }));
}

function StructureRow({ row, canEdit }: { row: StructureListRow; canEdit: boolean }) {
  const status = row.structureStatus;

  return (
    <tr className="border-t border-stone-100 align-middle">
      <td className="px-3 py-2 align-middle">
        <OrderIdentity order={row.order} />
      </td>
      {canEdit ? (
        <>
          <td className="px-3 py-2 align-middle">
            <form id={`structure-${row.order.id}`} action={saveStructureSpecification} className="flex min-w-0 items-center gap-2">
              <input type="hidden" name="orderId" value={row.order.id} />
              <input type="hidden" name="specifications" value={row.request?.specifications || defaultSpecification(row.order)} />
              <div className="min-w-0 flex-1">
                <p className="whitespace-normal break-words text-sm font-semibold uppercase leading-5 text-stone-950">
                  {row.request?.specifications || defaultSpecification(row.order)}
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">Estructuras</span>
            </form>
          </td>
          <td className="px-3 py-2 align-middle">
            <input form={`structure-${row.order.id}`} type="hidden" name="status" value={status === "in_progress" ? "in_progress" : status === "done" ? "done" : "requested"} />
            <StructureStatusControls row={row} />
          </td>
          <td className="px-3 py-2 align-middle">
            <div className="flex items-center gap-1.5">
              <label className="grid size-9 cursor-pointer place-items-center rounded-md border border-stone-200 bg-white text-stone-600 hover:bg-stone-50" title="Adjuntar archivo">
                <Paperclip className="size-4" />
                <input form={`structure-${row.order.id}`} name="file" type="file" accept="image/*,application/pdf" className="sr-only" />
              </label>
              <button form={`structure-${row.order.id}`} type="submit" className="grid size-9 place-items-center rounded-md bg-stone-950 text-white hover:bg-stone-800" title="Guardar" aria-label="Guardar">
                <Pencil className="size-4" />
              </button>
            </div>
          </td>
        </>
      ) : (
        <>
          <td className="px-3 py-2 align-middle">
            <p className="whitespace-normal break-words text-sm font-semibold uppercase leading-5 text-stone-950">
              {row.request?.specifications || defaultSpecification(row.order)}
            </p>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Estructuras</p>
          </td>
          <td className="px-3 py-2 align-middle"><StatusDisplay status={status} /></td>
          <td className="px-3 py-2 align-middle"><AttachmentLink request={row.request} /></td>
        </>
      )}
    </tr>
  );
}

function StructureMobileRow({ row, canEdit }: { row: StructureListRow; canEdit: boolean }) {
  const status = row.structureStatus;

  return (
    <article className="rounded-md border border-stone-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <OrderIdentity order={row.order} />
        <AttachmentLink request={row.request} />
      </div>
      {canEdit ? (
        <form action={saveStructureSpecification} className="mt-3 grid gap-2">
          <input type="hidden" name="orderId" value={row.order.id} />
          <input type="hidden" name="specifications" value={row.request?.specifications || defaultSpecification(row.order)} />
          <p className="whitespace-normal break-words text-sm font-semibold uppercase leading-5 text-stone-950">
            {row.request?.specifications || defaultSpecification(row.order)}
          </p>
          <input type="hidden" name="status" value={status === "in_progress" ? "in_progress" : status === "done" ? "done" : "requested"} />
          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
            <StructureStatusControls row={row} compact />
            <label className="grid size-10 cursor-pointer place-items-center rounded-md border border-stone-200 bg-white text-stone-600">
              <Paperclip className="size-4" />
              <input name="file" type="file" accept="image/*,application/pdf" className="sr-only" />
            </label>
            <button type="submit" className="grid size-10 place-items-center rounded-md bg-stone-950 text-white">
              <Pencil className="size-4" />
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-3">
          <p className="text-sm font-semibold uppercase text-stone-950">{row.request?.specifications || defaultSpecification(row.order)}</p>
          <div className="mt-2"><StatusDisplay status={status} /></div>
        </div>
      )}
    </article>
  );
}

function StructureStatusControls({ row, compact = false }: { row: StructureListRow; compact?: boolean }) {
  const specification = row.request?.specifications || defaultSpecification(row.order);
  const isDone = row.structureStatus === "done";

  return (
    <div className={compact ? "min-w-0" : "flex min-w-0 items-center"}>
      <StructureStatusButton
        orderId={row.order.id}
        specifications={specification}
        status={isDone ? "requested" : "done"}
        currentStatus={isDone ? "done" : "pending"}
      />
    </div>
  );
}

function StructureStatusButton({
  orderId,
  specifications,
  status,
  currentStatus,
}: {
  orderId: string;
  specifications: string;
  status: "requested" | "done";
  currentStatus: "pending" | "done";
}) {
  const isDone = currentStatus === "done";
  const Icon = isDone ? CheckSquare : Square;
  return (
    <form action={setStructureOrderStatus}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="specifications" value={specifications} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        title={isDone ? "Volver a pendiente" : "Marcar como completado"}
        aria-label={isDone ? "Volver estructura a pendiente" : "Marcar estructura como completada"}
        className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition ${
          isDone
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
            : "border-amber-200 bg-amber-50 text-amber-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
        }`}
      >
        <Icon className="size-3.5" />
        {isDone ? "Completado" : "Pendiente"}
      </button>
    </form>
  );
}

function OrderIdentity({ order }: { order: Order }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-mono text-base font-semibold tracking-tight text-stone-950">{order.code}</p>
      <p className="mt-0.5 truncate text-xs font-medium text-stone-500">{order.store === "LR" ? "La Reina" : "Leather House"}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-stone-700">{order.client}</p>
    </div>
  );
}

function AttachmentLink({ request }: { request?: StructureRequest }) {
  if (request?.attachments.length) {
    return (
      <a href={request.attachments[0].url} target="_blank" rel="noreferrer" className="grid size-9 place-items-center rounded-md border border-stone-200 bg-white text-stone-700 hover:bg-stone-50" aria-label="Abrir adjunto" title="Abrir adjunto">
        <Paperclip className="size-4" />
      </a>
    );
  }
  return (
    <span className="grid size-9 place-items-center rounded-md border border-stone-100 bg-stone-50 text-stone-300" title="Sin adjunto">
      <Paperclip className="size-4" />
    </span>
  );
}

function StatusDisplay({ status }: { status: string }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
        <CheckSquare className="size-4" />
        Completado
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700">
        <CheckSquare className="size-4" />
        En confección
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700">
      <Square className="size-4 text-stone-300" />
      Pendiente
    </span>
  );
}

function defaultSpecification(order: Order) {
  return `01 ${order.product}`;
}

function structureStatusFromOrder(order: Order): StructureListRow["structureStatus"] {
  const step = order.steps.find((item) => item.key === "structure");
  if (step?.status === "done") return "done";
  if (step?.status === "active") return "in_progress";
  return "pending";
}
