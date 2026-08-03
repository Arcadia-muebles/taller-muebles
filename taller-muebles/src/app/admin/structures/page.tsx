import { AppShell } from "@/components/app-shell";
import { StructuresWorkspace } from "@/components/structures-workspace";
import { requireSession } from "@/lib/auth";
import { activeOrders } from "@/lib/metrics";
import { getStructureRequestsSnapshot, listOrders } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import type { Order, StructureRequest } from "@/lib/types";

export type StructureListRow = {
  order: Order;
  request?: StructureRequest;
  structureStatus: "unrequested" | "requested" | "in_progress" | "done";
  syncWarning: boolean;
};

export default async function StructuresPage() {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const [orders, requestSnapshot, settings] = await Promise.all([
    listOrders(),
    getStructureRequestsSnapshot(),
    getSystemSettings(),
  ]);
  const canEdit = user.role === "admin" || (user.role === "manager" && settings.permissions.managersCanEditOrders);

  return (
    <AppShell active="admin" user={user}>
      <StructuresWorkspace
        rows={requestSnapshot.loadError ? [] : buildRows(orders, requestSnapshot.requests)}
        canEdit={canEdit && !requestSnapshot.loadError}
        loadError={requestSnapshot.loadError}
      />
    </AppShell>
  );
}

function buildRows(orders: Order[], requests: StructureRequest[]): StructureListRow[] {
  const requestByOrderId = new Map(
    requests
      .filter((request) => request.status !== "cancelled")
      .map((request) => [request.orderId, request]),
  );
  const cancelledOrderIds = new Set(
    requests
      .filter((request) => request.status === "cancelled")
      .map((request) => request.orderId),
  );

  return activeOrders(orders)
    .filter((order) => order.steps.some((step) => step.key === "structure"))
    .filter((order) => requestByOrderId.has(order.id) || !cancelledOrderIds.has(order.id))
    .map((order) => {
      const request = requestByOrderId.get(order.id);
      return {
        order,
        request,
        structureStatus: structureStatusFromOrder(order, request),
        syncWarning: hasStructureStatusMismatch(order, request),
      };
    })
    .sort((a, b) => {
      const rank = { in_progress: 0, requested: 1, unrequested: 2, done: 3 };
      return rank[a.structureStatus] - rank[b.structureStatus] || a.order.deliveryDate.localeCompare(b.order.deliveryDate);
    });
}

function structureStatusFromOrder(order: Order, request?: StructureRequest): StructureListRow["structureStatus"] {
  if (request?.status === "requested") return "requested";
  if (request?.status === "in_progress") return "in_progress";
  if (request?.status === "done") return "done";
  if (request?.status === "draft") return "unrequested";

  const step = order.steps.find((item) => item.key === "structure");
  if (step?.status === "done") return "done";
  if (step?.status === "active") return "in_progress";
  return "unrequested";
}

function hasStructureStatusMismatch(order: Order, request?: StructureRequest) {
  if (!request) return false;
  const step = order.steps.find((item) => item.key === "structure");
  if (!step) return true;
  if (request.status === "draft" || request.status === "requested") return step.status !== "pending";
  if (request.status === "in_progress") return step.status !== "active";
  if (request.status === "done") return step.status !== "done";
  return false;
}
