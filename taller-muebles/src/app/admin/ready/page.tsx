import { CalendarDays, PackageCheck, Truck } from "lucide-react";
import Link from "next/link";
import { closeOrder } from "@/app/admin/orders/actions";
import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { readyForDeliveryOrders } from "@/lib/metrics";
import { listOrders } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import { deliveryLabel, formatDate, hasMeaningfulObservations } from "@/lib/utils";

export default async function ReadyForDeliveryPage() {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const [orders, settings] = await Promise.all([listOrders(), getSystemSettings()]);
  const ready = readyForDeliveryOrders(orders).sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
  const canClose = user.role === "admin" || (user.role === "manager" && settings.permissions.managersCanEditOrders);

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
        <Summary icon={Truck} label="Por confirmar" value={ready.length} />
      </section>

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
                <HeaderCell>Producto</HeaderCell>
                <HeaderCell>Color</HeaderCell>
                <HeaderCell>Entrega</HeaderCell>
                <HeaderCell>Avance</HeaderCell>
                <HeaderCell>Accion</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {ready.map((order) => {
                const progress = 100;
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
                      <p className="whitespace-normal break-words text-xs font-semibold uppercase leading-5 text-stone-950">{order.product}</p>
                      <p className="mt-1 truncate text-[11px] font-medium uppercase tracking-[0.04em] text-stone-500">Pedido {order.groupCode}</p>
                    </BodyCell>
                    <BodyCell>
                      <p className="truncate text-xs font-semibold text-stone-900">{order.color || "Sin color"}</p>
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
                      {canClose ? (
                        <form action={closeOrder}>
                          <input type="hidden" name="orderId" value={order.id} />
                          <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-stone-950 px-3 text-xs font-semibold uppercase text-white transition hover:bg-stone-800">
                            <Truck className="size-3.5" />
                            Entregar
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs font-medium text-stone-500">Solo lectura</span>
                      )}
                    </BodyCell>
                  </tr>
                );
              })}
              {!ready.length ? (
                <tr>
                  <td colSpan={6} className="rounded-lg border border-dashed border-stone-200 bg-white px-4 py-10 text-center text-sm text-stone-500">
                    No hay órdenes listas para entrega.
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
