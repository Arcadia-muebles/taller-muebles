import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Filter, MoreVertical, Pencil, Plus, Sun, Truck } from "lucide-react";
import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import { cancelAgendaItem, completeAgendaItem, createAgendaTask, scheduleOrderDelivery, updateAgendaItem } from "@/app/admin/agenda/actions";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DismissibleDetails } from "@/components/dismissible-details";
import { PrintPageButton } from "@/components/print-page-button";
import { requireSession } from "@/lib/auth";
import { readyForDeliveryOrders } from "@/lib/metrics";
import { isProductionOrder, productionOrderGroup } from "@/lib/orders";
import { listAgendaItems, listOrders } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import type { AgendaItem, AgendaTimeSlot, Order } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type AgendaPageProps = {
  searchParams?: Promise<{ date?: string; scheduled?: string; kind?: string; status?: string; slot?: string }>;
};

type AgendaFilters = {
  kind: "all" | "delivery" | "task";
  status: "all" | "pending" | "done";
  slot: "all" | AgendaTimeSlot;
};

export default async function AgendaPage({ searchParams }: AgendaPageProps) {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const params = searchParams ? await searchParams : {};
  const selectedDate = normalizeDateParam(params.date) ?? todayLocalDate();
  const filters = normalizeAgendaFilters(params);
  const [orders, settings, dayAgendaItems, allAgendaItems] = await Promise.all([
    listOrders(),
    getSystemSettings(),
    listAgendaItems(selectedDate),
    listAgendaItems(),
  ]);

  const productionOrders = orders.filter(isProductionOrder);
  const canEdit = user.role === "admin" || (user.role === "manager" && settings.permissions.managersCanEditOrders);
  const ready = readyForDeliveryOrders(productionOrders, allAgendaItems).sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
  const ordersById = new Map(productionOrders.map((order) => [order.id, order]));
  const visibleItems = filterAgendaItems(
    dayAgendaItems.filter((item) => item.kind === "delivery" && item.status !== "cancelled" && item.orderId && ordersById.has(item.orderId)),
    filters,
  );
  const activeFilters = activeFilterCount(filters);

  return (
    <AppShell active="admin" user={user}>
      <header className="page-header">
        <div>
          <h1 className="page-title">Despachos</h1>
          <p className="page-description">Organiza las entregas listas, sus bloques horarios y la información necesaria para cada ruta.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionDetails
            icon={Truck}
            label="Agendar entrega"
            description="Desde listos para entrega"
            disabled={!canEdit || !ready.length}
          >
            <form action={scheduleOrderDelivery} className="space-y-3">
              <label className="block">
                <span className="field-label">Orden lista</span>
                <select name="orderId" className="control mt-1" required disabled={!canEdit || !ready.length}>
                  {ready.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.code} - {order.client} ({productionOrderGroup(productionOrders, order).length} producto{productionOrderGroup(productionOrders, order).length === 1 ? "" : "s"})
                    </option>
                  ))}
                </select>
              </label>
              <AgendaFormFields selectedDate={selectedDate} />
              <label className="block">
                <span className="field-label">Info de entrega</span>
                <textarea name="notes" className="textarea-control mt-1 min-h-20" maxLength={500} placeholder="Referencia, contacto, acceso, instrucciones o datos relevantes" disabled={!canEdit || !ready.length} />
              </label>
              <button type="submit" className="btn btn-primary w-full" disabled={!canEdit || !ready.length}>Agendar</button>
            </form>
          </ActionDetails>

          <ActionDetails
            icon={ClipboardCheck}
            label="Nueva tarea"
            description="Para planificación diaria"
            disabled={!canEdit}
          >
            <form action={createAgendaTask} className="space-y-3">
              <input type="hidden" name="returnTo" value="/admin/agenda" />
              <label className="block">
                <span className="field-label">Tarea</span>
                <input
                  name="title"
                  className="control mt-1"
                  required
                  minLength={3}
                  maxLength={120}
                  placeholder="Ej. Confirmar horario con cliente"
                  disabled={!canEdit}
                />
              </label>
              <label className="block">
                <span className="field-label">Importancia</span>
                <select name="priority" defaultValue="normal" className="control mt-1" disabled={!canEdit}>
                  <option value="critical">Urgente</option>
                  <option value="high">Alta</option>
                  <option value="normal">Normal</option>
                  <option value="low">Baja</option>
                </select>
              </label>
              <AgendaFormFields selectedDate={selectedDate} />
              <label className="block">
                <span className="field-label">Detalle</span>
                <textarea
                  name="notes"
                  className="textarea-control mt-1 min-h-20"
                  maxLength={400}
                  placeholder="Responsable, contexto o resultado esperado"
                  disabled={!canEdit}
                />
              </label>
              <button type="submit" className="btn btn-primary w-full" disabled={!canEdit}>Crear tarea</button>
            </form>
          </ActionDetails>

          <Link href={`/admin/planning?date=${selectedDate}`} className="btn btn-primary">
            <Plus className="size-4" />
            Planificación diaria
          </Link>

          <ActionDetails icon={Filter} label="Filtros" description={activeFilters ? `${activeFilters} activos` : undefined}>
            <form action="/admin/agenda" className="space-y-3">
              <input type="hidden" name="date" value={selectedDate} />
              <label className="block">
                <span className="field-label">Estado</span>
                <select name="status" defaultValue={filters.status} className="control mt-1">
                  <option value="all">Todos</option>
                  <option value="pending">Pendientes</option>
                  <option value="done">Hechas</option>
                </select>
              </label>
              <label className="block">
                <span className="field-label">Bloque</span>
                <select name="slot" defaultValue={filters.slot} className="control mt-1">
                  <option value="all">Todo el dia</option>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <button type="submit" className="btn btn-primary">Aplicar</button>
                <Link href={`/admin/agenda?date=${selectedDate}`} className="btn btn-secondary">Limpiar</Link>
              </div>
            </form>
          </ActionDetails>
        </div>
      </header>
      {params.scheduled === "local" ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          Despacho guardado en modo local. Aplica la migración de Supabase para persistir estos datos en la base de datos.
        </div>
      ) : null}

      <div className="agenda-print-area agenda-print-content mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <header className="agenda-print-heading hidden">
          <div>
            <h1>Despachos</h1>
            <p>Entregas programadas</p>
          </div>
          <p>{formatDate(selectedDate)}</p>
        </header>
        <section className="min-w-0">
          <div className="agenda-screen-controls mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <DateNavButton href={`/admin/agenda?date=${addDays(selectedDate, -1)}`} icon={ChevronLeft} label="Dia anterior" />
              <DatePickerDetails selectedDate={selectedDate} />
              <DateNavButton href={`/admin/agenda?date=${addDays(selectedDate, 1)}`} icon={ChevronRight} label="Dia siguiente" />
            </div>
            <div className="flex gap-2">
              <Link href={`/admin/agenda?date=${todayLocalDate()}`} className="btn btn-secondary">Hoy</Link>
              <PrintPageButton bodyClassName="printing-agenda" />
            </div>
          </div>

          <div className="agenda-print-sections space-y-4">
            {filters.slot !== "PM" ? <AgendaSection slot="AM" items={visibleItems} ordersById={ordersById} canEdit={canEdit} /> : null}
            {filters.slot !== "AM" ? <AgendaSection slot="PM" items={visibleItems} ordersById={ordersById} canEdit={canEdit} /> : null}
          </div>
        </section>

        <aside className="agenda-print-sidebar space-y-4">
          <MiniCalendar selectedDate={selectedDate} />
          <SidebarList
            title="Listos para entregar"
            count={ready.length}
            tone="green"
            empty="No hay órdenes pendientes de agendar."
          >
            {ready.slice(0, 3).map((order) => (
              <ReadySidebarItem
                key={order.id}
                order={order}
                groupOrders={productionOrderGroup(productionOrders, order)}
                canEdit={canEdit}
                selectedDate={selectedDate}
              />
            ))}
            {ready.length > 3 ? <Link href="/admin/ready" className="block rounded-md bg-stone-50 py-2 text-center text-xs font-medium text-stone-700">Ver todas</Link> : null}
          </SidebarList>
        </aside>
      </div>
    </AppShell>
  );
}

function AgendaSection({
  slot,
  items,
  ordersById,
  canEdit,
}: {
  slot: AgendaTimeSlot;
  items: AgendaItem[];
  ordersById: Map<string, Order>;
  canEdit: boolean;
}) {
  const slotItems = items
    .filter((item) => item.timeSlot === slot)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const label = slot === "AM" ? "09:00 - 13:00 hrs" : "14:00 - 18:00 hrs";
  const sectionTone = slot === "AM" ? "emerald" : "sky";

  return (
    <section className="relative overflow-visible rounded-lg border border-stone-200 bg-white">
      <header className={cn(
        "flex items-center justify-between border-b px-4 py-3",
        sectionTone === "emerald" ? "border-emerald-100 bg-emerald-50/70 text-emerald-900" : "border-sky-100 bg-sky-50/70 text-sky-900",
      )}>
        <div className="flex items-center gap-3">
          <span className={cn(
            "grid size-8 place-items-center rounded-full",
            sectionTone === "emerald" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700",
          )}>
            <Sun className="size-4" />
          </span>
          <p className="text-sm font-semibold">{slot} <span className="ml-2 text-stone-600">{label}</span></p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-stone-700">{slotItems.length} entregas</span>
      </header>
      <div className="divide-y divide-stone-100">
        {slotItems.map((item) => (
          <AgendaCard key={item.id} item={item} order={item.orderId ? ordersById.get(item.orderId) : undefined} canEdit={canEdit} />
        ))}
        {!slotItems.length ? (
          <div className="p-6 text-sm text-stone-500">Sin despachos para este bloque.</div>
        ) : null}
      </div>
    </section>
  );
}

function AgendaCard({ item, order, canEdit }: { item: AgendaItem; order?: Order; canEdit: boolean }) {
  const isDelivery = item.kind === "delivery";
  return (
    <article className={cn(
      "grid gap-3 px-4 py-4 sm:grid-cols-[44px_minmax(0,1fr)_auto]",
      isDelivery ? "border-l-4 border-l-emerald-600 bg-emerald-50/25" : "border-l-4 border-l-orange-500 bg-orange-50/20",
    )}>
      <div className={cn("grid size-10 place-items-center rounded-md", isDelivery ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-600")}>
        {isDelivery ? <Truck className="size-5" /> : <ClipboardCheck className="size-5" />}
      </div>
      <div className="min-w-0">
        {isDelivery && order ? (
          <>
            <Link href={`/admin/orders/${order.id}`} className="text-lg font-semibold text-emerald-800 hover:underline">{order.code}</Link>
            <p className="mt-1 text-sm font-semibold text-stone-950">{order.client}</p>
            <p className="mt-1 text-sm text-stone-600">{item.title.includes("productos") ? item.title : order.product}</p>
            {hasDeliveryInfo(item, order) ? (
              <p className="mt-2 rounded-md border border-emerald-100 bg-white px-3 py-2 text-sm leading-5 text-stone-700">
                {deliveryInfo(item, order)}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-stone-500">{order.material} · Color: {order.color || "Sin color"}</p>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-600">Tarea</p>
            <p className="mt-1 text-sm font-semibold text-stone-950">{item.title}</p>
            {item.notes ? <p className="mt-1 text-sm text-stone-600">{item.notes}</p> : null}
          </>
        )}
      </div>
      <div className="flex items-start gap-2 sm:justify-end">
        <span className={cn("rounded-md px-2 py-1 text-xs font-semibold uppercase", isDelivery ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700")}>
          {isDelivery ? "Ruta" : "Tarea"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-600">
          <CheckCircle2 className="size-3.5" />
          {item.status === "done" ? "Hecha" : "Pendiente"}
        </span>
        {canEdit && item.status === "pending" ? (
          <DismissibleDetails className="relative z-30 open:z-50">
            <summary className="grid size-8 cursor-pointer list-none place-items-center rounded-md border border-stone-200 bg-white text-stone-500 hover:text-stone-950">
              <MoreVertical className="size-4" />
            </summary>
            <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-md border border-stone-200 bg-white p-1 shadow-xl shadow-stone-950/10">
              <details>
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded px-3 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-50">
                  <Pencil className="size-3.5 text-stone-400" />
                  Editar
                </summary>
                <form action={updateAgendaItem} className="space-y-2 border-t border-stone-100 p-3">
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="kind" value={item.kind} />
                  {item.kind === "task" ? (
                    <label className="block">
                      <span className="field-label">Tarea</span>
                      <input name="title" defaultValue={item.title} className="control mt-1" required minLength={3} maxLength={120} />
                    </label>
                  ) : null}
                  <AgendaFormFields selectedDate={item.scheduledDate} defaultSlot={item.timeSlot} compact />
                  <label className="block">
                    <span className="field-label">{isDelivery ? "Info entrega" : "Detalle"}</span>
                    <textarea name="notes" defaultValue={isDelivery && order ? deliveryInfo(item, order) : item.notes} className="textarea-control mt-1 min-h-20" maxLength={500} placeholder={isDelivery ? "Referencia, contacto, acceso o instruccion" : "Cliente, proveedor o contexto"} />
                  </label>
                  <button type="submit" className="h-8 w-full rounded-md bg-stone-950 px-2 text-xs font-semibold text-white hover:bg-stone-800">Guardar cambios</button>
                </form>
              </details>
              <form action={completeAgendaItem}>
                <input type="hidden" name="itemId" value={item.id} />
                <button type="submit" className="w-full rounded px-3 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-50">Marcar hecha</button>
              </form>
              <form action={cancelAgendaItem}>
                <input type="hidden" name="itemId" value={item.id} />
                <ConfirmSubmitButton
                  title="Quitar de despachos"
                  description="El despacho se ocultará de la vista, pero conservará su registro para trazabilidad."
                  confirmLabel="Quitar despacho"
                  pendingLabel="Quitando..."
                  trigger="Quitar de despachos"
                  triggerClassName="w-full rounded px-3 py-2 text-left text-xs font-medium text-rose-700 hover:bg-rose-50"
                />
              </form>
            </div>
          </DismissibleDetails>
        ) : null}
      </div>
    </article>
  );
}

function hasDeliveryInfo(item: AgendaItem, order: Order) {
  return Boolean(deliveryInfo(item, order));
}

function deliveryInfo(item: AgendaItem, order: Order) {
  const value = item.notes?.trim();
  if (!value) return "";
  return isAutoDeliveryInfo(value, order) ? "" : value;
}

function isAutoDeliveryInfo(value: string, order: Order) {
  const normalized = normalizeDeliveryInfo(value);
  return normalized === normalizeDeliveryInfo(`${order.client} ${order.product}`);
}

function normalizeDeliveryInfo(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
function ActionDetails({
  icon: Icon,
  label,
  description,
  disabled,
  children,
}: {
  icon: ElementType;
  label: string;
  description?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <DismissibleDetails className="relative">
      <summary className={cn(
        "btn list-none border",
        label === "Nueva tarea" ? "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800" : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
        disabled && "pointer-events-none opacity-50",
      )}>
        <Icon className="size-4" />
        <span className="text-left leading-tight">
          <span className="block">{label}</span>
          {description ? <span className="block text-[11px] font-semibold opacity-80">{description}</span> : null}
        </span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-stone-200 bg-white p-4 shadow-xl shadow-stone-950/10">
        {children}
      </div>
    </DismissibleDetails>
  );
}

function AgendaFormFields({ selectedDate, compact = false, defaultSlot = "AM" }: { selectedDate: string; compact?: boolean; defaultSlot?: AgendaTimeSlot }) {
  return (
    <div className={compact ? "grid gap-2" : "grid grid-cols-2 gap-3"}>
      <label className="block">
        <span className="field-label">Fecha</span>
        <input type="date" name="scheduledDate" defaultValue={selectedDate} className="control mt-1" required />
      </label>
      <label className="block">
        <span className="field-label">Bloque</span>
        <select name="timeSlot" defaultValue={defaultSlot} className="control mt-1">
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </label>
    </div>
  );
}

function MiniCalendar({ selectedDate }: { selectedDate: string }) {
  const monthDays = calendarDays(selectedDate);
  const monthLabel = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(parseLocalDate(selectedDate));

  return (
    <section className="panel-pad">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-950">Calendario</h2>
        <div className="flex gap-1">
          <DateNavButton href={`/admin/agenda?date=${addMonths(selectedDate, -1)}`} icon={ChevronLeft} label="Mes anterior" compact />
          <DateNavButton href={`/admin/agenda?date=${addMonths(selectedDate, 1)}`} icon={ChevronRight} label="Mes siguiente" compact />
        </div>
      </div>
      <p className="mb-3 text-center text-sm font-semibold capitalize text-stone-900">{monthLabel}</p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
          <span key={`${day}-${index}`} className="py-1 font-semibold text-stone-500">{day}</span>
        ))}
        {monthDays.map((day) => (
          <Link
            key={day.date}
            href={`/admin/agenda?date=${day.date}`}
            className={cn(
              "grid h-8 place-items-center rounded-full text-xs font-medium",
              day.inMonth ? "text-stone-900" : "text-stone-400",
              day.date === selectedDate && "bg-emerald-700 text-white",
            )}
          >
            {day.day}
          </Link>
        ))}
      </div>
    </section>
  );
}

function SidebarList({ title, count, tone, empty, children }: { title: string; count: number; tone: "green" | "orange"; empty: string; children: ReactNode }) {
  return (
    <section className="panel-pad">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-950">{title}</h2>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold text-white", tone === "green" ? "bg-emerald-700" : "bg-orange-500")}>{count}</span>
      </div>
      <div className="space-y-2">
        {count ? children : <p className="rounded-md bg-stone-50 p-3 text-xs text-stone-500">{empty}</p>}
      </div>
    </section>
  );
}

function ReadySidebarItem({
  order,
  groupOrders,
  canEdit,
  selectedDate,
}: {
  order: Order;
  groupOrders: Order[];
  canEdit: boolean;
  selectedDate: string;
}) {
  return (
    <div className="rounded-md border border-stone-100 bg-white p-3">
      <div className="flex items-start gap-2">
        <Truck className="mt-0.5 size-4 shrink-0 text-stone-600" />
        <div className="min-w-0 flex-1">
          <Link href={`/admin/orders/${order.id}`} className="text-xs font-semibold text-emerald-800 hover:underline">{order.code}</Link>
          <p className="truncate text-xs font-medium text-stone-700">{order.client}</p>
          <p className="truncate text-xs text-stone-500">{groupOrders.length > 1 ? `${groupOrders.length} productos` : order.product}</p>
        </div>
      </div>
      {canEdit ? (
        <details className="mt-2">
          <summary className="grid h-8 w-full cursor-pointer list-none place-items-center rounded-md bg-emerald-700 px-2 text-xs font-semibold text-white hover:bg-emerald-800">
            {groupOrders.length > 1 ? `Agendar pedido (${groupOrders.length})` : "Agendar"}
          </summary>
          <form action={scheduleOrderDelivery} className="mt-2 rounded-md border border-emerald-100 bg-emerald-50/60 p-2">
            <input type="hidden" name="orderId" value={order.id} />
            <AgendaFormFields selectedDate={selectedDate} compact />
            <label className="mt-2 block">
              <span className="field-label">Info entrega</span>
              <textarea name="notes" className="textarea-control mt-1 min-h-16" maxLength={500} placeholder="Referencia o instrucción" />
            </label>
            <button type="submit" className="mt-2 h-8 w-full rounded-md bg-emerald-700 px-2 text-xs font-semibold text-white hover:bg-emerald-800">Confirmar despacho</button>
          </form>
        </details>
      ) : null}
    </div>
  );
}

function DatePickerDetails({ selectedDate }: { selectedDate: string }) {
  return (
    <DismissibleDetails className="relative">
      <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-stone-900 transition hover:bg-stone-50">
        <CalendarDays className="size-4 text-stone-500" />
        <span className="text-base font-semibold sm:text-lg">{longDateLabel(selectedDate)}</span>
      </summary>
      <form action="/admin/agenda" className="absolute left-0 z-30 mt-2 w-72 rounded-lg border border-stone-200 bg-white p-4 shadow-xl shadow-stone-950/10">
        <label className="block">
          <span className="field-label">Fecha</span>
          <input type="date" name="date" defaultValue={selectedDate} className="control mt-1" required />
        </label>
        <button type="submit" className="btn btn-primary mt-3 w-full">Ir a fecha</button>
      </form>
    </DismissibleDetails>
  );
}

function DateNavButton({ href, icon: Icon, label, compact }: { href: string; icon: ElementType; label: string; compact?: boolean }) {
  return (
    <Link href={href} aria-label={label} title={label} className={cn("grid place-items-center rounded-md border border-stone-200 bg-white text-stone-700 hover:bg-stone-50", compact ? "size-7" : "size-10")}>
      <Icon className="size-4" />
    </Link>
  );
}

function normalizeDateParam(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function normalizeAgendaFilters(params: { kind?: string; status?: string; slot?: string }): AgendaFilters {
  return {
    kind: params.kind === "delivery" || params.kind === "task" ? params.kind : "all",
    status: params.status === "pending" || params.status === "done" ? params.status : "all",
    slot: params.slot === "AM" || params.slot === "PM" ? params.slot : "all",
  };
}

function filterAgendaItems(items: AgendaItem[], filters: AgendaFilters) {
  return items.filter((item) => (
    (filters.kind === "all" || item.kind === filters.kind) &&
    (filters.status === "all" || item.status === filters.status) &&
    (filters.slot === "all" || item.timeSlot === filters.slot)
  ));
}

function activeFilterCount(filters: AgendaFilters) {
  return [filters.kind !== "all", filters.status !== "all", filters.slot !== "all"].filter(Boolean).length;
}

function todayLocalDate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

function parseLocalDate(date: string) {
  return new Date(`${date}T12:00:00`);
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const value = parseLocalDate(date);
  value.setDate(value.getDate() + days);
  return toDateInputValue(value);
}

function addMonths(date: string, months: number) {
  const value = parseLocalDate(date);
  value.setMonth(value.getMonth() + months);
  return toDateInputValue(value);
}

function longDateLabel(date: string) {
  const value = parseLocalDate(date);
  const label = new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function calendarDays(date: string) {
  const selected = parseLocalDate(date);
  const first = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
  const start = new Date(first);
  const mondayOffset = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return {
      date: toDateInputValue(day),
      day: day.getDate(),
      inMonth: day.getMonth() === selected.getMonth(),
    };
  });
}
