import type { Order, OrderStatus, ProductionStep, StepStatus } from "./types";

export function isIndependentStartStep(stepKey: string) {
  return stepKey === "structure" || stepKey === "cutting";
}

export function productionStepPrerequisitesMet(
  steps: Array<Pick<ProductionStep, "key" | "status">>,
  stepIndex: number,
) {
  const step = steps[stepIndex];
  if (!step) return false;
  if (step.key === "cutting") return true;
  return steps.slice(0, stepIndex).every((previousStep) => previousStep.status === "done");
}

export function canProductionStepsRunTogether(firstKey: string, secondKey: string) {
  return isIndependentStartStep(firstKey) || isIndependentStartStep(secondKey);
}

export function productionStepsResetByReversal(
  steps: ProductionStep[],
  currentStepIndex: number,
) {
  const currentStep = steps[currentStepIndex];
  if (!currentStep) return [];
  if (isIndependentStartStep(currentStep.key)) return [];
  return steps
    .slice(currentStepIndex + 1)
    .filter((step) => !canProductionStepsRunTogether(currentStep.key, step.key));
}

export function isProductionOrder(order: Pick<Order, "documentType">) {
  return order.documentType !== "quote";
}

export function orderGroupKey(order: Pick<Order, "store" | "groupCode" | "code">) {
  return `${order.store}:${order.groupCode?.trim() || order.code}`;
}

export function compareOrderGroupMembers(
  first: Pick<Order, "product" | "id">,
  second: Pick<Order, "product" | "id">,
) {
  return first.product.localeCompare(second.product, "es", { sensitivity: "base" }) || first.id.localeCompare(second.id);
}

export function productionOrderGroup(orders: Order[], seed: Order) {
  const groupKey = orderGroupKey(seed);
  return orders
    .filter((order) => (
      isProductionOrder(order) &&
      order.status !== "cancelled" &&
      orderGroupKey(order) === groupKey
    ))
    .sort(compareOrderGroupMembers);
}

export function orderGroupPositions(orders: Order[]) {
  const groups = new Map<string, Order[]>();
  for (const order of orders.filter((item) => isProductionOrder(item) && item.status !== "cancelled")) {
    const key = orderGroupKey(order);
    groups.set(key, [...(groups.get(key) ?? []), order]);
  }

  const positions = new Map<string, { index: number; total: number }>();
  for (const unsortedGroup of groups.values()) {
    const group = [...unsortedGroup].sort(compareOrderGroupMembers);
    if (group.length < 2) continue;
    group.forEach((order, index) => positions.set(order.id, { index: index + 1, total: group.length }));
  }
  return positions;
}

export function orderStatusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    draft: "Borrador",
    scheduled: "Sin empezar",
    in_production: "En producción",
    blocked: "Bloqueada",
    urgent: "Urgente",
    quality_control: "Listo para entrega",
    completed: "Entregada",
    cancelled: "Cancelada",
  };
  return labels[status];
}

export function stepStatusLabel(status: StepStatus) {
  const labels: Record<StepStatus, string> = {
    pending: "Pendiente",
    active: "Activo",
    done: "Listo",
    blocked: "Bloqueado",
  };
  return labels[status];
}
