import { daysUntil } from "./utils";
import type { Order, StepStatus } from "./types";

export function activeOrders(orders: Order[]) {
  return orders.filter((order) => !["completed", "cancelled"].includes(order.status));
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
