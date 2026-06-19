import {
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
  Plus,
  ShieldCheck,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ProductionBoard } from "@/components/production-board";
import { StatCard } from "@/components/stat-card";
import { requireSession } from "@/lib/auth";
import { activeOrders, blockedOrders, overdueOrders } from "@/lib/metrics";
import { listOrderComments, listOrders } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";

export default async function AdminPage() {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const [orders, settings] = await Promise.all([listOrders(), getSystemSettings()]);
  const canEditOrders = user.role === "admin" || (user.role === "manager" && settings.permissions.managersCanEditOrders);
  const active = activeOrders(orders);
  const overdue = overdueOrders(orders);
  const blocked = blockedOrders(orders);
  const waitingQuality = active.filter((order) => currentStepKey(order) === "quality");
  const dispatching = active.filter((order) => currentStepKey(order) === "dispatch");
  const commentsByOrder = Object.fromEntries(
    await Promise.all(active.map(async (order) => [order.id, await listOrderComments(order.id)])),
  );

  return (
    <AppShell active="admin" user={user}>
      <header className="page-header">
        <div>
          <p className="page-kicker">ARCADIA</p>
          <h1 className="page-title">Control de produccion</h1>
          <p className="page-description">
            Vista diaria simple para revisar atrasos, calidad, despacho y avance del taller.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditOrders ? (
            <Link href="/admin/orders/new" className="btn btn-primary">
              <Plus className="size-4" />
              Nueva orden
            </Link>
          ) : null}
        </div>
      </header>

      <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Activas" value={String(active.length)} helper="Ordenes abiertas." icon={ClipboardCheck} />
        <StatCard label="Atrasadas" value={String(overdue.length)} helper="Fuera de plazo." icon={CalendarDays} tone={overdue.length ? "rose" : "neutral"} />
        <StatCard label="Detenidas" value={String(blocked.length)} helper="Bloqueos o decisiones." icon={AlertTriangle} tone={blocked.length ? "rose" : "neutral"} />
        <StatCard label="Calidad" value={String(waitingQuality.length)} helper="Esperando aprobacion." icon={ShieldCheck} tone={waitingQuality.length ? "amber" : "neutral"} />
        <StatCard label="Despacho" value={String(dispatching.length)} helper="Listas para salida." icon={Truck} tone={dispatching.length ? "emerald" : "neutral"} />
      </section>

      <ProductionBoard orders={active} steps={settings.production.steps} canMove={canEditOrders} commentsByOrder={commentsByOrder} />
    </AppShell>
  );
}

function currentStepKey(order: { steps: Array<{ key: string; status: string }> }) {
  return (
    order.steps.find((step) => step.status === "active") ??
    order.steps.find((step) => step.status === "blocked") ??
    order.steps.find((step) => step.status === "pending")
  )?.key;
}
