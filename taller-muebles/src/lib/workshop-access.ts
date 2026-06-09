import type { AreaKey, Order, ProductionStep, Role } from "@/lib/types";

export type WorkshopUser = {
  name: string;
  role: Role;
  area?: AreaKey;
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
  if (!user.area) return true;
  const step = nextWorkStep(order);
  return Boolean(step && canWorkerUseStep(user, step));
}

export function canWorkerUseStep(user: WorkshopUser, step: ProductionStep) {
  if (user.role !== "operator") return true;
  if (!user.area) return true;
  return Boolean(user.area && step.key === user.area && samePerson(step.owner, user.name));
}

export function filterWorkerOrders(user: WorkshopUser, orders: Order[]) {
  return user.role === "operator" ? orders.filter((order) => canWorkerSeeOrder(user, order)) : orders;
}

function samePerson(left: string, right: string) {
  return normalizeName(left) === normalizeName(right);
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase("es-CL");
}
