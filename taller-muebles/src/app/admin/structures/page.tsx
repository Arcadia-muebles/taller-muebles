import { AppShell } from "@/components/app-shell";
import { StructuresWorkspace } from "@/components/structures-workspace";
import { requireSession } from "@/lib/auth";
import { activeOrders } from "@/lib/metrics";
import { listOrders, listStructureRequests } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import type { Order, StructureRequest } from "@/lib/types";

export type StructureListRow = {
  order: Order;
  request?: StructureRequest;
  structureStatus: "unrequested" | "requested" | "in_progress" | "done";
};

export default async function StructuresPage() {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const [orders, requests, settings] = await Promise.all([listOrders(), listStructureRequests(), getSystemSettings()]);
  const canEdit = user.role === "admin" || (user.role === "manager" && settings.permissions.managersCanEditOrders);

  return (
    <AppShell active="admin" user={user}>
      <StructuresWorkspace rows={buildRows(orders, requests)} canEdit={canEdit} />
    </AppShell>
  );
}

function buildRows(orders: Order[], requests: StructureRequest[]): StructureListRow[] {
  const requestByOrderId = new Map(
    requests
      .filter((request) => request.status !== "cancelled")
      .map((request) => [request.orderId, request]),
  );

  return activeOrders(orders)
    .filter((order) => order.steps.some((step) => step.key === "structure"))
    .map((order) => {
      const request = requestByOrderId.get(order.id);
      return { order, request, structureStatus: structureStatusFromOrder(order, request) };
    })
    .sort((a, b) => {
      const rank = { in_progress: 0, requested: 1, unrequested: 2, done: 3 };
      return rank[a.structureStatus] - rank[b.structureStatus] || a.order.deliveryDate.localeCompare(b.order.deliveryDate);
    });
}

function structureStatusFromOrder(order: Order, request?: StructureRequest): StructureListRow["structureStatus"] {
  const step = order.steps.find((item) => item.key === "structure");
  if (step?.status === "done") return "done";
  if (step?.status === "active") return "in_progress";
  if (request?.status === "requested") return "requested";
  return "unrequested";
}
