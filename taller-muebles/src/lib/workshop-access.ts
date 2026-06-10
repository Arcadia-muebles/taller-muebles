import type { AreaKey, Order, ProductionStep, Role } from "@/lib/types";

export type WorkshopUser = {
  name: string;
  role: Role;
  area?: AreaKey;
  areas?: AreaKey[];
};

export function nextWorkStep(order: Order) {
  return (
    order.steps.find((step) => step.status === "active") ??
    order.steps.find((step) => step.status === "blocked") ??
    order.steps.find((step) => step.status === "pending")
  );
}

export function canWorkerSeeOrder(user: WorkshopUser, order: Order) {
  if (user.role !== "operator") return true;
  if (["completed", "cancelled"].includes(order.status)) return false;
  const step = nextWorkStep(order);
  return Boolean(step && workerAreas(user).includes(step.key));
}

export function canWorkerUseStep(user: WorkshopUser, step: ProductionStep) {
  return user.role !== "operator" || workerAreas(user).includes(step.key);
}

export function filterWorkerOrders(user: WorkshopUser, orders: Order[]) {
  return user.role === "operator" ? orders.filter((order) => canWorkerSeeOrder(user, order)) : orders;
}

export function workerAreas(user: WorkshopUser) {
  return user.areas?.length ? user.areas : user.area ? [user.area] : [];
}
