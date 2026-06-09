import {
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
  Plus,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { OrderTable } from "@/components/order-table";
import { ProductionTimeline } from "@/components/production-timeline";
import { PrintButton } from "@/components/print-button";
import { StatCard } from "@/components/stat-card";
import { StockPanel } from "@/components/stock-panel";
import { requireSession } from "@/lib/auth";
import { getSystemSettings } from "@/lib/repositories/settings";
import { activeOrders, blockedOrders, overdueOrders, urgentOrders } from "@/lib/metrics";
import { listOrders, listStockItems } from "@/lib/repositories/production";
import { daysUntil } from "@/lib/utils";

export default async function AdminPage() {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const [orders, stockItems, settings] = await Promise.all([listOrders(), listStockItems(), getSystemSettings()]);
  const canEditOrders = user.role === "admin" || (user.role === "manager" && settings.permissions.managersCanEditOrders);
  
  const active = activeOrders(orders);
  const urgent = urgentOrders(orders);
  const overdue = overdueOrders(orders);
  const blocked = blockedOrders(orders);
  
  const nextDeliveries = active
    .filter((order) => daysUntil(order.deliveryDate) >= 0)
    .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))
    .slice(0, 3);

  return (
    <AppShell active="admin" user={user}>
      {/* Header del panel */}
      <header className="flex flex-col gap-4 border-b border-stone-200/50 pb-5 lg:flex-row lg:items-center lg:justify-between select-none">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9E7A5A]">
            Panel administrador
          </p>
          <h1 className="mt-2 text-[32px] font-medium tracking-tight text-stone-900 font-serif leading-tight">
            Producción, ventas activas y control operativo
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-stone-500 font-medium">
            Vista ejecutiva para revisar avance diario, atrasos, responsables, stock crítico y prioridades entre Leather House y La Reina.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5 items-center">
          <PrintButton />
          {canEditOrders ? (
            <Link
              href="/admin/orders/new"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2E2520] hover:bg-[#1E1815] px-4 text-xs font-bold text-white shadow-sm transition duration-150"
            >
              <Plus className="size-3.5" />
              Nueva orden
            </Link>
          ) : null}
        </div>
      </header>

      {/* KPI Cards Row */}
      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Órdenes activas"
          value={String(active.length)}
          helper="Producción abierta entre ambas tiendas."
          icon={ClipboardCheck}
          tone="blue"
          diff="+2 vs ayer"
          diffType="up-green"
        />
        <StatCard
          label="Urgentes"
          value={String(urgent.length)}
          helper="Requieren seguimiento diario."
          icon={AlertTriangle}
          tone="amber"
          diff="+1 vs ayer"
          diffType="up-red"
        />
        <StatCard
          label="Atrasadas"
          value={String(overdue.length)}
          helper="Compromisos fuera de plazo."
          icon={CalendarDays}
          tone="emerald"
          diff="-1 vs ayer"
          diffType="down-green"
        />
        <StatCard
          label="Bloqueadas"
          value={String(blocked.length)}
          helper="Frenadas por decisión, material o revisión."
          icon={Lock}
          tone="neutral"
        />
      </section>

      {/* Main dashboard list: Table spanning full width, bottom cards split in 3 columns */}
      <div className="mt-6 flex flex-col gap-6 min-w-0">
        {/* Table */}
        <OrderTable orders={active} canEditOrders={canEditOrders} />

        {/* Bottom row (Proceso + Entregas + Stock) */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {/* Carga por proceso */}
          <ProductionTimeline orders={active} />
          
          {/* Próximas entregas */}
          <section className="rounded-2xl border border-stone-200/60 bg-white p-5 shadow-sm shadow-stone-100/30 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between select-none">
                <div>
                  <h2 className="text-xl font-serif font-medium text-stone-900">Próximas entregas</h2>
                  <p className="text-xs text-stone-400 font-semibold mt-1">Órdenes con entrega en los próximos 7 días</p>
                </div>
                <Link href="/admin/history" className="text-xs font-bold text-[#9E7A5A] hover:underline">
                  Ver todas
                </Link>
              </div>
              
              <div className="mt-5 space-y-3">
                {nextDeliveries.map((order) => {
                  const days = daysUntil(order.deliveryDate);
                  const daysLeft = days === 0 ? "Hoy" : days === 1 ? "1 día" : `${days} días`;
                  const dateText = order.deliveryDate.slice(8, 10);
                  const monthText = new Intl.DateTimeFormat("es-CL", { month: "short" })
                    .format(new Date(order.deliveryDate + "T00:00:00"))
                    .slice(0, 3)
                    .toUpperCase();

                  // Determinar color de badge de días restantes
                  const badgeColor = days <= 2 ? "text-rose-600" : "text-orange-600";

                  return (
                    <div
                      key={order.id}
                      className="flex items-center gap-3.5 p-3 rounded-xl bg-stone-50/40 border border-stone-200/40 hover:bg-[#FAF6F0]/30 transition select-none"
                    >
                      {/* Date badge */}
                      <div className="flex flex-col items-center justify-center size-12 shrink-0 rounded-lg bg-[#F5ECE5] text-stone-850 border border-[#D9C3B0]/30">
                        <span className="text-sm font-bold leading-none">{dateText}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider mt-1 text-[#9E7A5A]">{monthText}</span>
                      </div>
                      {/* Detail */}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-stone-900 text-sm leading-tight truncate">{order.code}</p>
                        <p className="text-xs text-stone-400 font-semibold truncate mt-0.5">{order.client} &middot; {order.product}</p>
                      </div>
                      {/* Days left */}
                      <span className={`text-xs font-bold shrink-0 self-start mt-0.5 ${badgeColor}`}>
                        {daysLeft}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <Link href="/admin/history" className="text-xs font-semibold text-[#9E7A5A] hover:text-stone-850 hover:underline transition inline-flex items-center gap-1 mt-5 border-t border-stone-100 pt-3.5">
              Ver calendario completo &rarr;
            </Link>
          </section>

          {/* Stock crítico */}
          <StockPanel items={stockItems} />
        </div>
      </div>
    </AppShell>
  );
}
