import { Plus } from "lucide-react";
import Link from "next/link";
import { ActiveProductionDashboard } from "@/components/active-production-dashboard";
import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { activeOrders } from "@/lib/metrics";
import { listOrders } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";

export default async function AdminPage() {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const [orders, settings] = await Promise.all([listOrders(), getSystemSettings()]);
  const canEditOrders = user.role === "admin" || (user.role === "manager" && settings.permissions.managersCanEditOrders);
  const active = activeOrders(orders);

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
          {canEditOrders ? (
            <Link href="/admin/orders/new" className="btn btn-primary">
              <Plus className="size-4" />
              Nueva orden
            </Link>
          ) : null}
        </div>
      </header>

      <ActiveProductionDashboard orders={active} steps={settings.production.steps} canMove={canEditOrders} />
    </AppShell>
  );
}
