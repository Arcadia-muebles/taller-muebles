import { Check, ClipboardList, FileUp, Hammer, Play, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { createStructureRequest, setStructureRequestStatus } from "@/app/admin/structures/actions";
import { requireSession } from "@/lib/auth";
import { activeOrders } from "@/lib/metrics";
import { listOrders, listStructureRequests } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import type { Order, StructureRequest } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default async function StructuresPage() {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const [orders, requests, settings] = await Promise.all([listOrders(), listStructureRequests(), getSystemSettings()]);
  const canEdit = user.role === "admin" || (user.role === "manager" && settings.permissions.managersCanEditOrders);
  const candidates = activeOrders(orders).filter((order) => order.steps.some((step) => step.key === "structure"));

  return (
    <AppShell active="admin" user={user}>
      <header className="page-header">
        <div>
          <p className="page-kicker">Estructuras</p>
          <h1 className="page-title">Lista de estructuras</h1>
          <p className="page-description">
            Solicitudes internas para fabricar estructuras con especificaciones y adjuntos.
          </p>
        </div>
      </header>

      {canEdit ? <StructureRequestForm orders={candidates} /> : null}

      <section className="panel mt-5">
        <div className="panel-header flex items-center gap-3">
          <ClipboardList className="size-5 text-stone-500" />
          <div>
            <h2 className="panel-title">Solicitudes</h2>
            <p className="panel-description">{requests.length} registros de estructura.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Cliente / producto</th>
                <th className="px-4 py-3">Especificaciones</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Adjuntos</th>
                {canEdit ? <th className="px-4 py-3">Acción</th> : null}
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <StructureRow key={request.id} request={request} canEdit={canEdit} />
              ))}
              {!requests.length ? (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="px-4 py-10 text-center text-sm text-stone-500">
                    Aún no hay estructuras solicitadas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function StructureRequestForm({ orders }: { orders: Order[] }) {
  return (
    <form action={createStructureRequest} className="panel mt-5">
      <div className="panel-header flex items-center gap-3">
        <Hammer className="size-5 text-stone-500" />
        <div>
          <h2 className="panel-title">Nueva solicitud</h2>
          <p className="panel-description">Selecciona un pedido activo y describe lo que necesita estructura.</p>
        </div>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <label>
          <span className="field-label">Pedido</span>
          <select name="orderId" required className="control-lg mt-2 bg-white">
            <option value="">Seleccionar pedido</option>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.code} | {order.client} | {order.product}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Estado inicial</span>
          <select name="status" defaultValue="requested" className="control-lg mt-2 bg-white">
            <option value="requested">Solicitada</option>
            <option value="in_progress">En fabricación</option>
            <option value="draft">Borrador</option>
          </select>
        </label>
        <label>
          <span className="field-label">Responsable</span>
          <input name="assignedTo" className="control-lg mt-2 bg-white" placeholder="Opcional" />
        </label>
        <label>
          <span className="field-label">Adjunto</span>
          <input
            name="file"
            type="file"
            accept="image/*,application/pdf"
            className="mt-2 block w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-stone-200 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-stone-800"
          />
        </label>
        <label className="md:col-span-2">
          <span className="field-label">Especificaciones de estructura</span>
          <textarea name="specifications" required minLength={3} className="textarea-control mt-2 min-h-28 bg-white" placeholder="Medidas, refuerzos, plano, notas para el maestro..." />
        </label>
      </div>
      <div className="border-t border-stone-200 p-4">
        <button type="submit" className="btn btn-primary">
          <Plus className="size-4" />
          Crear solicitud
        </button>
      </div>
    </form>
  );
}

function StructureRow({ request, canEdit }: { request: StructureRequest; canEdit: boolean }) {
  return (
    <tr className="border-t border-stone-100">
      <td className="px-4 py-3 align-top">
        <p className="font-mono text-sm font-semibold text-stone-950">{request.orderCode}</p>
        <p className="mt-1 text-xs text-stone-500">{formatDate(request.requestedAt)}</p>
      </td>
      <td className="px-4 py-3 align-top">
        <p className="text-sm font-semibold text-stone-950">{request.client}</p>
        <p className="mt-1 line-clamp-2 text-sm text-stone-600">{request.product}</p>
      </td>
      <td className="max-w-[320px] px-4 py-3 align-top text-sm leading-6 text-stone-700">
        <p className="line-clamp-3">{request.specifications}</p>
      </td>
      <td className="px-4 py-3 align-top">
        <span className={statusClass(request.status)}>{statusLabel(request.status)}</span>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="grid gap-1">
          {request.attachments.slice(0, 3).map((attachment) => (
            <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 underline-offset-4 hover:text-stone-950 hover:underline">
              <FileUp className="size-3.5" />
              {attachment.fileName}
            </a>
          ))}
          {!request.attachments.length ? <span className="text-xs text-stone-400">Sin adjuntos</span> : null}
        </div>
      </td>
      {canEdit ? (
        <td className="px-4 py-3 align-top">
          <div className="flex flex-wrap gap-2">
            {request.status !== "in_progress" && request.status !== "done" ? (
              <StatusButton id={request.id} status="in_progress" label="Fabricar" icon={Play} />
            ) : null}
            {request.status !== "done" ? (
              <StatusButton id={request.id} status="done" label="Lista" icon={Check} />
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  );
}

function StatusButton({ id, status, label, icon: Icon }: { id: string; status: string; label: string; icon: React.ElementType }) {
  return (
    <form action={setStructureRequestStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className="btn btn-secondary h-9">
        <Icon className="size-4" />
        {label}
      </button>
    </form>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Borrador",
    requested: "Solicitada",
    in_progress: "En fabricación",
    done: "Lista",
    cancelled: "Cancelada",
  };
  return labels[status] ?? status;
}

function statusClass(status: string) {
  const base = "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium";
  if (status === "done") return `${base} border-emerald-200 bg-emerald-50 text-emerald-700`;
  if (status === "requested" || status === "in_progress") return `${base} border-sky-200 bg-sky-50 text-sky-800`;
  if (status === "cancelled") return `${base} border-stone-200 bg-stone-100 text-stone-600`;
  return `${base} border-stone-200 bg-white text-stone-600`;
}
