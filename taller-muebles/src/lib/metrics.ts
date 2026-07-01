import { daysUntil } from "./utils";
import type { AgendaItem, Order, StepStatus } from "./types";

export function activeOrders(orders: Order[]) {
  return orders.filter((order) => !["completed", "cancelled"].includes(order.status));
}

export function isReadyForDelivery(order: Order) {
  if (order.status === "quality_control") return true;
  if (!order.steps.length) return false;
  if (order.steps.every((step) => step.status === "done")) return true;

  const lastStep = order.steps.at(-1);
  const lastStepIsFinishedGate = lastStep ? /dispatch|despacho|terminado/i.test(`${lastStep.key} ${lastStep.label}`) : false;
  return Boolean(
    lastStep &&
      lastStepIsFinishedGate &&
      lastStep.status !== "blocked" &&
      order.steps.slice(0, -1).every((step) => step.status === "done"),
  );
}

export function readyForDeliveryOrders(orders: Order[], agendaItems: AgendaItem[] = []) {
  const scheduledOrderIds = new Set(
    agendaItems
      .filter((item) => item.kind === "delivery" && item.status === "pending" && item.orderId)
      .map((item) => item.orderId),
  );
  return activeOrders(orders).filter((order) => isReadyForDelivery(order) && !scheduledOrderIds.has(order.id));
}

export function completedOrders(orders: Order[]) {
  return orders.filter((order) => order.status === "completed");
}

export function overdueOrders(orders: Order[]) {
  return activeOrders(orders).filter((order) => daysUntil(order.deliveryDate) < 0);
}

export function urgentOrders(orders: Order[]) {
  return activeOrders(orders).filter(
    (order) => order.priority === "critical" || order.status === "urgent",
  );
}

export function blockedOrders(orders: Order[]) {
  return activeOrders(orders).filter(
    (order) =>
      order.status === "blocked" ||
      order.steps.some((step) => step.status === "blocked"),
  );
}

export function completionPercent(order: Order) {
  if (!order.steps.length) return 0;
  const done = order.steps.filter((step) => step.status === "done").length;
  return Math.round((done / order.steps.length) * 100);
}

export function statusCount(orders: Order[], status: StepStatus) {
  return orders.flatMap((order) => order.steps).filter((step) => step.status === status)
    .length;
}

export function areaLoad(orders: Order[]) {
  const areas = new Map<string, { active: number; blocked: number; done: number }>();
  for (const order of activeOrders(orders)) {
    for (const step of order.steps) {
      const current = areas.get(step.label) ?? { active: 0, blocked: 0, done: 0 };
      if (step.status === "active") current.active += 1;
      if (step.status === "blocked") current.blocked += 1;
      if (step.status === "done") current.done += 1;
      areas.set(step.label, current);
    }
  }
  return Array.from(areas.entries()).map(([label, values]) => ({ label, ...values }));
}
