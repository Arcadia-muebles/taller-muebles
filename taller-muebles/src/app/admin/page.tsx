import { Plus } from "lucide-react";
import Link from "next/link";
import { ActiveProductionDashboard } from "@/components/active-production-dashboard";
import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { activeOrders, isReadyForDelivery, readyForDeliveryOrders } from "@/lib/metrics";
import { listOrders } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";

export default async function AdminPage() {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const [orders, settings] = await Promise.all([listOrders(), getSystemSettings()]);
  const canEditOrders = user.role === "admin" || (user.role === "manager" && settings.permissions.managersCanEditOrders);
  const active = activeOrders(orders);
  const ready = readyForDeliveryOrders(orders);
  const inProduction = active.filter((order) => !isReadyForDelivery(order));

  return (
    <AppShell active="admin" user={user}>
      <header className="page-header">
        <div>
          <p className="page-kicker">ARCADIA</p>
          <h1 className="page-title">Produccion activa</h1>
          <p className="page-description">
            Resumen operativo del taller con etapas editables desde la misma tabla.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/ready" className="btn btn-secondary">
            Listos para entrega
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700">{ready.length}</span>
          </Link>
          {canEditOrders ? (
            <Link href="/admin/orders/new" className="btn btn-primary">
              <Plus className="size-4" />
              Nueva orden
            </Link>
          ) : null}
        </div>
      </header>

      <ActiveProductionDashboard orders={inProduction} steps={settings.production.steps} canMove={canEditOrders} />
    </AppShell>
  );
}
