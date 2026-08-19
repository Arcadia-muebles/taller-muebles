"use client";

import {
  CalendarClock,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createClientPortalLink,
  revokeClientPortalLink,
  updateClientPortalLink,
  type ClientPortalActionResult,
} from "@/app/admin/client-portals/actions";
import type { ClientPortalManagementClient } from "@/lib/client-portal-admin";
import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type ClientPortalManagerProps = {
  clients: ClientPortalManagementClient[];
  loadError: boolean;
};

type Filter = "all" | "active" | "without";
type Modal =
  | { mode: "create"; clientKey: string }
  | { mode: "edit"; clientKey: string }
  | undefined;

const emptyResult: ClientPortalActionResult = { ok: false, message: "" };

export function ClientPortalManager({ clients, loadError }: ClientPortalManagerProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string>();
  const [modal, setModal] = useState<Modal>();
  const [lifetimeDays, setLifetimeDays] = useState("90");
  const [result, setResult] = useState<ClientPortalActionResult>(emptyResult);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const activeCount = clients.filter((client) => client.activeLink).length;
  const withoutCount = clients.length - activeCount;
  const expiringCount = clients.filter((client) => client.activeLink?.expiringSoon).length;
  const selectedClient = modal ? clients.find((client) => client.clientKey === modal.clientKey) : undefined;

  const visibleClients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es-CL");
    return clients.filter((client) => {
      if (filter === "active" && !client.activeLink) return false;
      if (filter === "without" && client.activeLink) return false;
      if (!normalized) return true;
      return [client.name, client.identityLabel, ...client.documents.map((document) => document.code)]
        .join(" ")
        .toLocaleLowerCase("es-CL")
        .includes(normalized);
    });
  }, [clients, filter, query]);

  function openModal(nextModal: Exclude<Modal, undefined>) {
    setResult(emptyResult);
    setCopied(false);
    setLifetimeDays("90");
    setModal(nextModal);
  }

  function submitCreate(formData: FormData) {
    setResult(emptyResult);
    startTransition(async () => {
      const nextResult = await createClientPortalLink(formData);
      setResult(nextResult);
      if (nextResult.ok) router.refresh();
    });
  }

  function submitEdit(formData: FormData) {
    setResult(emptyResult);
    startTransition(async () => {
      const nextResult = await updateClientPortalLink(formData);
      setResult(nextResult);
      if (nextResult.ok) router.refresh();
    });
  }

  function revoke(client: ClientPortalManagementClient) {
    if (!client.activeLink) return;
    const confirmed = window.confirm(
      `¿Eliminar el acceso de ${client.name}? El enlace dejará de funcionar inmediatamente y la acción quedará auditada.`,
    );
    if (!confirmed) return;

    const formData = new FormData();
    formData.set("linkId", client.activeLink.id);
    startTransition(async () => {
      const nextResult = await revokeClientPortalLink(formData);
      setResult(nextResult);
      if (nextResult.ok) router.refresh();
    });
  }

  async function copyCreatedLink() {
    if (!result.path) return;
    await navigator.clipboard.writeText(new URL(result.path, window.location.origin).toString());
    setCopied(true);
  }

  const managementAvailable = !loadError && clients.length > 0;

  return (
    <section className="mt-5 space-y-4">
      {loadError ? <Notice tone="danger">No fue posible cargar los enlaces. Intenta nuevamente antes de realizar cambios.</Notice> : null}
      {result.message && !modal ? <Notice tone={result.ok ? "success" : "danger"}>{result.message}</Notice> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Enlaces activos" value={activeCount} icon={ShieldCheck} />
        <Metric label="Sin acceso" value={withoutCount} icon={Link2} />
        <Metric label="Vencen en 14 días" value={expiringCount} icon={CalendarClock} />
      </div>

      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-stone-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-stone-950">Clientes y accesos</h2>
            <p className="mt-1 text-sm text-stone-500">El alcance se calcula por RUT, correo o teléfono; si faltan, se limita a una sola nota.</p>
          </div>
          <button
            type="button"
            onClick={() => clients[0] && openModal({ mode: "create", clientKey: clients[0].clientKey })}
            disabled={!managementAvailable || pending}
            className="btn btn-primary shrink-0"
          >
            <Plus className="size-4" />
            Crear enlace
          </button>
        </div>

        <div className="grid gap-3 border-b border-stone-200 bg-stone-50 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por cliente, RUT, correo o nota"
              className="control pl-9"
            />
          </label>
          <div className="flex flex-wrap gap-2" aria-label="Filtrar clientes">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>Todos</FilterButton>
            <FilterButton active={filter === "active"} onClick={() => setFilter("active")}>Activos</FilterButton>
            <FilterButton active={filter === "without"} onClick={() => setFilter("without")}>Sin acceso</FilterButton>
          </div>
        </div>

        <div className="divide-y divide-stone-200">
          {visibleClients.map((client) => {
            const isExpanded = expanded === client.clientKey;
            return (
              <article key={client.clientKey}>
                <div className="grid gap-4 p-4 xl:grid-cols-[minmax(220px,1.35fr)_minmax(180px,.8fr)_minmax(180px,.85fr)_auto] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold text-stone-950">{client.name}</h3>
                      <StatusPill active={Boolean(client.activeLink)} />
                    </div>
                    <p className="mt-1 truncate text-sm text-stone-500">{client.identityLabel}</p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-400">Alcance</p>
                    <p className="mt-1 text-sm font-medium text-stone-800">
                      {client.documents.length} {client.documents.length === 1 ? "pedido" : "pedidos"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-400">Vigencia</p>
                    <p className="mt-1 text-sm font-medium text-stone-800">
                      {client.activeLink ? `Hasta ${formatDate(client.activeLink.expiresAt)}` : latestAccessLabel(client)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? undefined : client.clientKey)}
                      className="btn btn-secondary"
                    >
                      <Eye className="size-4" />
                      Ver pedidos
                      <ChevronDown className={cn("size-4 transition", isExpanded && "rotate-180")} />
                    </button>
                    {client.activeLink ? (
                      <>
                        <button type="button" onClick={() => openModal({ mode: "edit", clientKey: client.clientKey })} className="btn btn-secondary">
                          <Pencil className="size-4" />
                          Modificar
                        </button>
                        <button type="button" onClick={() => openModal({ mode: "create", clientKey: client.clientKey })} className="btn btn-secondary">
                          <Link2 className="size-4" />
                          Nuevo
                        </button>
                        <button type="button" onClick={() => revoke(client)} disabled={pending} className="btn btn-danger" title="Eliminar acceso">
                          <Trash2 className="size-4" />
                          Eliminar
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => openModal({ mode: "create", clientKey: client.clientKey })} className="btn btn-primary">
                        <Plus className="size-4" />
                        Crear link
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded ? <OrderScope client={client} /> : null}
              </article>
            );
          })}

          {!visibleClients.length ? (
            <div className="p-8 text-center">
              <Link2 className="mx-auto size-8 text-stone-300" />
              <p className="mt-3 text-sm font-medium text-stone-700">No encontramos clientes con ese filtro.</p>
              <p className="mt-1 text-sm text-stone-500">Prueba otro nombre, RUT, correo o número de nota.</p>
            </div>
          ) : null}
        </div>
      </div>

      {modal && selectedClient ? (
        <ModalShell title={modal.mode === "create" ? "Crear enlace de seguimiento" : "Modificar vigencia"} onClose={() => setModal(undefined)}>
          {modal.mode === "create" ? (
            result.path ? (
              <CreatedLink result={result} copied={copied} onCopy={copyCreatedLink} />
            ) : (
              <form action={submitCreate} className="space-y-4">
                <Field label="Cliente">
                  <select
                    name="orderId"
                    value={selectedClient.anchorOrderId}
                    onChange={(event) => {
                      const client = clients.find((item) => item.anchorOrderId === event.target.value);
                      if (client) openModal({ mode: "create", clientKey: client.clientKey });
                    }}
                    className="control"
                  >
                    {clients.map((client) => (
                      <option key={client.clientKey} value={client.anchorOrderId}>{client.name} · {client.identityLabel}</option>
                    ))}
                  </select>
                </Field>
                <ScopeSummary client={selectedClient} />
                <LifetimeSelect value={lifetimeDays} onChange={setLifetimeDays} />
                <input type="hidden" name="lifetimeDays" value={lifetimeDays} />
                {selectedClient.activeLink ? (
                  <Notice tone="warning">Crear uno nuevo invalidará inmediatamente el enlace activo.</Notice>
                ) : null}
                <ActionFeedback result={result} />
                <div className="flex justify-end gap-2 border-t border-stone-200 pt-4">
                  <button type="button" onClick={() => setModal(undefined)} className="btn btn-secondary">Cancelar</button>
                  <button type="submit" disabled={pending} className="btn btn-primary">
                    <Plus className="size-4" />
                    {pending ? "Creando…" : "Crear enlace"}
                  </button>
                </div>
              </form>
            )
          ) : (
            <form action={submitEdit} className="space-y-4">
              <input type="hidden" name="linkId" value={selectedClient.activeLink?.id} />
              <ScopeSummary client={selectedClient} />
              <LifetimeSelect value={lifetimeDays} onChange={setLifetimeDays} />
              <input type="hidden" name="lifetimeDays" value={lifetimeDays} />
              <p className="text-xs leading-5 text-stone-500">La nueva vigencia se calcula desde hoy. El enlace y su contenido no cambian.</p>
              <ActionFeedback result={result} />
              <div className="flex justify-end gap-2 border-t border-stone-200 pt-4">
                <button type="button" onClick={() => setModal(undefined)} className="btn btn-secondary">Cancelar</button>
                <button type="submit" disabled={pending || !selectedClient.activeLink} className="btn btn-primary">
                  <Check className="size-4" />
                  {pending ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </form>
          )}
        </ModalShell>
      ) : null}
    </section>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <div className="panel flex items-center gap-3 p-4">
      <span className="grid size-10 place-items-center rounded-lg border border-stone-200 bg-stone-50 text-stone-600"><Icon className="size-5" /></span>
      <div><p className="text-2xl font-semibold text-stone-950">{value}</p><p className="text-sm text-stone-500">{label}</p></div>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={cn("h-9 rounded-md border px-3 text-sm font-medium transition", active ? "border-stone-950 bg-stone-950 text-white" : "border-stone-200 bg-white text-stone-600 hover:border-stone-300")}>{children}</button>;
}

function StatusPill({ active }: { active: boolean }) {
  return <span className={cn("inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium", active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-stone-50 text-stone-500")}>{active ? "Activo" : "Sin acceso"}</span>;
}

function OrderScope({ client }: { client: ClientPortalManagementClient }) {
  return (
    <div className="border-t border-stone-100 bg-stone-50 px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-stone-800">Información visible para el cliente</p>
        <Link href={`/admin/orders/${client.anchorOrderId}`} className="text-xs font-medium text-stone-500 underline-offset-4 hover:text-stone-950 hover:underline">Abrir pedido más reciente</Link>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {client.documents.map((document) => (
          <div key={`${document.store}-${document.code}`} className="rounded-md border border-stone-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">{document.store} · {document.code}</p><span className="text-xs text-stone-500">{statusLabel(document.status)}</span></div>
            <p className="mt-1 text-xs text-stone-500">Entrega {formatDate(document.deliveryDate)} · {document.itemCount} {document.itemCount === 1 ? "producto" : "productos"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScopeSummary({ client }: { client: ClientPortalManagementClient }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <p className="font-semibold text-stone-950">{client.name}</p>
      <p className="mt-1 text-sm text-stone-600">{client.identityLabel}</p>
      <p className="mt-2 text-sm text-stone-700">El enlace mostrará {client.documents.length} {client.documents.length === 1 ? "pedido" : "pedidos"} y su avance de producción.</p>
    </div>
  );
}

function LifetimeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Field label="Vigencia desde hoy">
      <select value={value} onChange={(event) => onChange(event.target.value)} className="control">
        <option value="30">30 días</option>
        <option value="90">90 días</option>
        <option value="180">180 días</option>
        <option value="365">1 año</option>
      </select>
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-medium text-stone-600">{label}{children}</label>;
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-stone-950/35 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-stone-200 bg-white shadow-2xl sm:max-w-xl sm:rounded-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-stone-200 bg-white px-4 py-4">
          <div><p className="page-kicker">Portal clientes</p><h2 className="mt-1 text-lg font-semibold text-stone-950">{title}</h2></div>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-md border border-stone-200 text-stone-500 hover:bg-stone-50" aria-label="Cerrar"><X className="size-4" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function CreatedLink({ result, copied, onCopy }: { result: ClientPortalActionResult; copied: boolean; onCopy: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check className="size-5" /></span><div><p className="font-semibold text-emerald-950">Enlace listo para compartir</p><p className="mt-1 text-sm text-emerald-800">{result.message}</p></div></div>
        <input readOnly value={result.path} aria-label="Enlace creado" className="control mt-4 bg-white font-mono text-xs" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onCopy} className="btn btn-primary">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "Copiado" : "Copiar enlace"}</button>
          {result.path ? <Link href={result.path} target="_blank" className="btn btn-secondary"><ExternalLink className="size-4" />Abrir vista</Link> : null}
        </div>
      </div>
      <p className="text-xs leading-5 text-stone-500">Por seguridad, el token sólo se muestra ahora. Si se pierde, genera uno nuevo desde esta pantalla.</p>
    </div>
  );
}

function ActionFeedback({ result }: { result: ClientPortalActionResult }) {
  if (!result.message) return null;
  return <p className={cn("text-sm font-medium", result.ok ? "text-emerald-700" : "text-rose-700")}>{result.message}</p>;
}

function Notice({ tone, children }: { tone: "warning" | "danger" | "success"; children: React.ReactNode }) {
  return <div className={cn("rounded-lg border px-4 py-3 text-sm", tone === "warning" && "border-amber-200 bg-amber-50 text-amber-800", tone === "danger" && "border-rose-200 bg-rose-50 text-rose-800", tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800")}>{children}</div>;
}

function latestAccessLabel(client: ClientPortalManagementClient) {
  if (!client.latestLink) return "Nunca creado";
  if (client.latestLink.status === "revoked") return "Acceso eliminado";
  if (client.latestLink.status === "expired") return `Venció ${formatDate(client.latestLink.expiresAt)}`;
  return `Hasta ${formatDate(client.latestLink.expiresAt)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function statusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    draft: "Borrador",
    scheduled: "Programado",
    in_production: "En producción",
    blocked: "Bloqueado",
    urgent: "Urgente",
    quality_control: "Control de calidad",
    completed: "Completado",
    cancelled: "Cancelado",
  };
  return labels[status];
}
