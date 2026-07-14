import type { AreaKey, Order, ProductionStep, Role } from "@/lib/types";
import { isProductionOrder, productionStepPrerequisitesMet } from "@/lib/orders";

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
  if (!isProductionOrder(order)) return false;
  if (user.role !== "operator") return true;
  if (order.status === "cancelled") return false;
  if (order.status === "completed") return workerCompletedStep(user, order);
  return Boolean(
    actionableWorkerStep(user, order) ||
    reversibleWorkerStep(user, order) ||
    workerCompletedStep(user, order),
  );
}

export function canWorkerUseStep(user: WorkshopUser, step: ProductionStep) {
  return user.role !== "operator" || workerAreas(user).includes(step.key);
}

export function filterWorkerOrders(user: WorkshopUser, orders: Order[]) {
  return orders.filter((order) => isProductionOrder(order) && (user.role !== "operator" || canWorkerSeeOrder(user, order)));
}

export function filterWorkerFutureOrders(user: WorkshopUser, orders: Order[]) {
  if (user.role !== "operator") return [];
  const areas = workerAreas(user);
  return orders.filter((order) => {
    if (!isProductionOrder(order)) return false;
    if (order.status === "cancelled" || order.status === "completed") return false;

    // Planificación contains every order that still has work before the
    // operator's next pending stage. It must not depend on the main-queue
    // visibility rules, which also include completed and reversible work.
    const workerStepIndex = order.steps.findIndex((step) => (
      areas.includes(step.key) && step.status === "pending"
    ));
    if (workerStepIndex < 0 || productionStepPrerequisitesMet(order.steps, workerStepIndex)) return false;

    return order.steps.slice(0, workerStepIndex).some((step) => step.status !== "done");
  });
}

export function filterWorkerHistoryOrders(user: WorkshopUser, orders: Order[]) {
  if (user.role !== "operator") return [];
  return orders.filter((order) => isProductionOrder(order) && workerCompletedStep(user, order));
}

export function workerActionStep(user: WorkshopUser, order: Order) {
  const current = actionableWorkerStep(user, order);
  if (current) return current;
  return reversibleWorkerStep(user, order);
}

function actionableWorkerStep(user: WorkshopUser, order: Order) {
  const areas = workerAreas(user);
  return (
    order.steps.find((step) => areas.includes(step.key) && (step.status === "active" || step.status === "blocked")) ??
    order.steps.find((step, index) => (
      areas.includes(step.key) &&
      step.status === "pending" &&
      productionStepPrerequisitesMet(order.steps, index)
    ))
  );
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

function workerCompletedStep(user: WorkshopUser, order: Order) {
  const areas = workerAreas(user);
  return order.steps.some((step) => areas.includes(step.key) && step.status === "done");
}

function isWithinUndoWindow(completedAt?: string) {
  if (!completedAt) return true;
  const completedTime = new Date(completedAt).getTime();
  return Number.isFinite(completedTime) && Date.now() - completedTime <= 30 * 60 * 1000;
}
