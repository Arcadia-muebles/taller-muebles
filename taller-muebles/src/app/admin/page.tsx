import { Plus } from "lucide-react";
import Link from "next/link";
import { ActiveProductionDashboard } from "@/components/active-production-dashboard";
import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { isReadyForDelivery, readyForDeliveryOrders } from "@/lib/metrics";
import { isProductionOrder } from "@/lib/orders";
import { listAgendaItems, listCommentsForOrders, listOrders, listStructureRequests } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";

export default async function AdminPage() {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const [orders, settings, structureRequests, agendaItems] = await Promise.all([listOrders(), getSystemSettings(), listStructureRequests(), listAgendaItems()]);
  const productionOrders = orders.filter(isProductionOrder);
  const commentsByOrder = await listCommentsForOrders(productionOrders.map((order) => order.id));
  const canEditOrders = user.role === "admin" || (user.role === "manager" && settings.permissions.managersCanEditOrders);
  const ready = readyForDeliveryOrders(productionOrders, agendaItems);
  const productionFinished = productionOrders.filter((order) => !["completed", "cancelled"].includes(order.status) && isReadyForDelivery(order));

  return (
    <AppShell active="admin" user={user}>
      <header className="page-header">
        <div>
          <h1 className="page-title">Producción activa</h1>
          <p className="page-description">Estado real del taller y próximas entregas.</p>
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

      <ActiveProductionDashboard
        orders={productionOrders}
        steps={settings.production.steps}
        canMove={canEditOrders}
        canComment={user.role !== "viewer"}
        commentsByOrder={commentsByOrder}
        structureRequests={structureRequests}
        finishedCount={productionFinished.length}
      />
    </AppShell>
  );
}
