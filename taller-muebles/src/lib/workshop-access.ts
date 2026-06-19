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

export function workerStep(user: WorkshopUser, order: Order) {
  const areas = workerAreas(user);
  return order.steps.find((step) => areas.includes(step.key));
}

export function canWorkerSeeOrder(user: WorkshopUser, order: Order) {
  if (user.role !== "operator") return true;
  return Boolean(workerStep(user, order));
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
