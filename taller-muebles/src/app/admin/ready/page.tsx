import { CalendarDays, PackageCheck, Search, Truck, X } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { OrderLabelPrintButton } from "@/components/order-label-print-button";
import { ScheduleDeliveryButton } from "@/components/schedule-delivery-button";
import { requireSession } from "@/lib/auth";
import { readyForDeliveryOrders } from "@/lib/metrics";
import { productionOrderGroup } from "@/lib/orders";
import { listAgendaItems, listWorkshopOrders } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import { deliveryLabel, formatDate, hasMeaningfulObservations } from "@/lib/utils";

export default async function ReadyForDeliveryPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const [orders, settings, agendaItems, params] = await Promise.all([listWorkshopOrders(), getSystemSettings(), listAgendaItems(), searchParams]);
  const ready = readyForDeliveryOrders(orders, agendaItems).sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
  const query = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? "";
  const needle = query.toLocaleLowerCase("es-CL");
  const filteredReady = needle ? ready.filter((order) =>
    productionOrderGroup(orders, order).some((item) =>
      [item.code, item.groupCode, item.client, item.product, item.color].some((value) => value?.toLocaleLowerCase("es-CL").includes(needle)),
    ),
  ) : ready;
  const canSchedule = user.role === "admin" || (user.role === "manager" && settings.permissions.managersCanEditOrders);

  return (
    <AppShell active="admin" user={user}>
      <header className="page-header">
        <div>
          <p className="page-kicker">Producción</p>
          <h1 className="page-title">Listos para entrega</h1>
          <p className="page-description">
            Órdenes terminadas en taller, pendientes de entrega o retiro.
          </p>
        </div>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <Summary icon={PackageCheck} label="Listas" value={ready.length} />
        <Summary icon={CalendarDays} label="Vencen hoy" value={ready.filter((order) => deliveryLabel(order.deliveryDate, false) === "Hoy").length} />
        <Summary icon={Truck} label="Por agendar" value={ready.length} />
      </section>

      <form action="/admin/ready" className="mt-5 flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input name="q" type="search" defaultValue={query} placeholder="Buscar código, cliente, producto o color..." aria-label="Buscar pedidos listos para entrega" className="control h-11 w-full bg-white pl-9 pr-3" />
        </label>
        <button type="submit" className="btn btn-primary h-11"><Search className="size-4" />Buscar</button>
        {query ? <Link href="/admin/ready" className="btn btn-secondary h-11"><X className="size-4" />Limpiar</Link> : null}
      </form>
      {query ? <p className="mt-2 text-sm text-stone-500">{filteredReady.length} {filteredReady.length === 1 ? "pedido encontrado" : "pedidos encontrados"}.</p> : null}

      <section className="panel mt-5 overflow-hidden">
        <div className="overflow-x-auto bg-stone-50/70 p-1.5">
          <table className="w-full min-w-[860px] table-fixed border-separate border-spacing-y-1">
            <colgroup>
              <col className="w-[150px]" />
              <col className="w-[260px]" />
              <col className="w-[110px]" />
              <col className="w-[120px]" />
              <col className="w-[90px]" />
              <col className="w-[130px]" />
            </colgroup>
            <thead>
              <tr>
                <HeaderCell>Codigo / cliente</HeaderCell>
                <HeaderCell>Unidades / productos</HeaderCell>
                <HeaderCell>Color</HeaderCell>
                <HeaderCell>Entrega</HeaderCell>
                <HeaderCell>Avance</HeaderCell>
                <HeaderCell>Accion</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {filteredReady.map((order) => {
                const progress = 100;
                const groupOrders = productionOrderGroup(orders, order);
                const totalUnits = groupOrders.reduce((sum, item) => sum + orderQuantity(item.quantity), 0);
                const colors = [...new Set(groupOrders.map((item) => item.color).filter(Boolean))];
                return (
                  <tr key={order.id} className="group">
                    <BodyCell className="rounded-l-lg border-l">
                      <Link href={`/admin/orders/${order.id}`} className="block min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-lg font-semibold text-stone-950 group-hover:underline">{order.code}</p>
                          {hasMeaningfulObservations(order.observations) ? (
                            <span className="grid size-5 shrink-0 place-items-center rounded-full border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-700">!</span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-xs font-medium text-stone-600">{order.store === "LH" ? "Leather House" : "La Reina"}</p>
                        <p className="mt-0.5 truncate text-xs text-stone-500">{order.client}</p>
                      </Link>
                    </BodyCell>
                    <BodyCell>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-xs font-semibold text-stone-950">
                          {formatQuantity(totalUnits)} {totalUnits === 1 ? "unidad" : "unidades"}
                        </p>
                        <p className="truncate text-[10px] font-medium uppercase tracking-[0.04em] text-stone-500">Pedido {order.groupCode}</p>
                      </div>
                      <ul className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] uppercase leading-4 text-stone-600">
                        {groupOrders.map((item) => (
                          <li key={item.id} className="max-w-full break-words">
                            <span className="mr-1 font-mono font-semibold tabular-nums text-stone-900">{formatQuantity(orderQuantity(item.quantity))}×</span>
                            {item.product}
                          </li>
                        ))}
                      </ul>
                    </BodyCell>
                    <BodyCell>
                      <p className="truncate text-xs font-semibold text-stone-900">{colors.length > 1 ? "Varios" : colors[0] || "Sin color"}</p>
                    </BodyCell>
                    <BodyCell>
                      <p className="inline-flex items-center gap-1 text-xs font-semibold text-stone-900">
                        <CalendarDays className="size-3.5 text-stone-400" />
                        {formatDate(order.deliveryDate)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-emerald-700">{deliveryLabel(order.deliveryDate, false)}</p>
                    </BodyCell>
                    <BodyCell>
                      <p className="mb-1 text-xs font-semibold text-stone-900">{progress}%</p>
                      <div className="h-2.5 w-16 overflow-hidden rounded-full bg-stone-200">
                        <div className="h-full rounded-full bg-emerald-600" style={{ width: `${progress}%` }} />
                      </div>
                    </BodyCell>
                    <BodyCell className="rounded-r-lg border-r">
                      <div className="flex flex-col gap-2">
                        <OrderLabelPrintButton order={order} groupOrders={groupOrders} className="h-9 w-full justify-center px-2 text-xs" />
                        {canSchedule ? (
                          <ScheduleDeliveryButton orderId={order.id} defaultDate={order.deliveryDate} itemCount={groupOrders.length} />
                        ) : (
                          <span className="text-xs font-medium text-stone-500">Solo lectura</span>
                        )}
                      </div>
                    </BodyCell>
                  </tr>
                );
              })}
              {!filteredReady.length ? (
                <tr>
                  <td colSpan={6} className="rounded-lg border border-dashed border-stone-200 bg-white px-4 py-10 text-center text-sm text-stone-500">
                    {query ? "No hay pedidos que coincidan con la búsqueda." : "No hay órdenes listas para entrega."}
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

function Summary({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
      <Icon className="size-5" />
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
    </section>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-2 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">
      {children}
    </th>
  );
}

function BodyCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`border-y border-stone-200 bg-white px-2 py-2.5 align-middle text-sm shadow-sm transition group-hover:bg-stone-50 ${className ?? ""}`}>
      {children}
    </td>
  );
}

function orderQuantity(quantity?: number) {
  return typeof quantity === "number" && Number.isFinite(quantity) ? quantity : 1;
}

function formatQuantity(quantity: number) {
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(quantity);
}
