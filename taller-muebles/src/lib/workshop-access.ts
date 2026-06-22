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
  if (order.status === "cancelled") return false;
  const step = nextWorkStep(order);
  return Boolean(
    (step && workerAreas(user).includes(step.key)) ||
    reversibleWorkerStep(user, order),
  );
}

export function canWorkerUseStep(user: WorkshopUser, step: ProductionStep) {
  return user.role !== "operator" || workerAreas(user).includes(step.key);
}

export function filterWorkerOrders(user: WorkshopUser, orders: Order[]) {
  return user.role === "operator" ? orders.filter((order) => canWorkerSeeOrder(user, order)) : orders;
}

export function workerActionStep(user: WorkshopUser, order: Order) {
  const current = nextWorkStep(order);
  if (current && workerAreas(user).includes(current.key)) return current;
  return reversibleWorkerStep(user, order);
}

export function reversibleWorkerStep(user: WorkshopUser, order: Order) {
  const areas = workerAreas(user);
  for (let index = order.steps.length - 1; index >= 0; index -= 1) {
    const step = order.steps[index];
    if (step.status !== "done" || !areas.includes(step.key)) continue;
    const laterSteps = order.steps.slice(index + 1);
    if (laterSteps.some((item) => item.status !== "pending" || item.startedAt || item.completedAt)) return undefined;
    if (!isWithinUndoWindow(step.completedAt)) return undefined;
    return step;
  }
  return undefined;
}

export function workerAreas(user: WorkshopUser) {
  return user.areas?.length ? user.areas : user.area ? [user.area] : [];
}

function isWithinUndoWindow(completedAt?: string) {
  if (!completedAt) return true;
  const completedTime = new Date(completedAt).getTime();
  return Number.isFinite(completedTime) && Date.now() - completedTime <= 30 * 60 * 1000;
}
