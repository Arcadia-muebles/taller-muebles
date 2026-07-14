import { daysUntil, workshopHoursBetween } from "./utils";
import type { AgendaItem, AppUser, Order, StepStatus } from "./types";
import { isProductionOrder, orderGroupKey, productionOrderGroup } from "./orders";

export function activeOrders(orders: Order[]) {
  return orders.filter((order) => isProductionOrder(order) && !["completed", "cancelled"].includes(order.status));
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
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const scheduledGroups = new Set(
    agendaItems
      .filter((item) => item.kind === "delivery" && item.status === "pending" && item.orderId)
      .flatMap((item) => {
        const order = item.orderId ? ordersById.get(item.orderId) : undefined;
        return order ? [orderGroupKey(order)] : [];
      }),
  );
  const seenGroups = new Set<string>();

  return activeOrders(orders).filter((order) => {
    const groupKey = orderGroupKey(order);
    if (seenGroups.has(groupKey)) return false;
    seenGroups.add(groupKey);
    if (scheduledGroups.has(groupKey)) return false;
    return productionOrderGroup(orders, order).every(isReadyForDelivery);
  });
}

export function completedOrders(orders: Order[]) {
  return orders.filter((order) => isProductionOrder(order) && order.status === "completed");
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
  if (isReadyForDelivery(order)) return 100;
  const done = order.steps.filter((step) => step.status === "done").length;
  return Math.round((done / order.steps.length) * 100);
}

export function statusCount(orders: Order[], status: StepStatus) {
  return orders.filter(isProductionOrder).flatMap((order) => order.steps).filter((step) => step.status === status)
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

export type ProductivityMember = {
  name: string;
  assigned: number;
  completed: number;
  active: number;
  pending: number;
  blocked: number;
  completionRate: number;
  averageCycleHours?: number;
};

export type AreaProductivity = Omit<ProductivityMember, "name"> & {
  key: string;
  label: string;
  averageIdleHours?: number;
  members: ProductivityMember[];
};

type ProductivityCounter = Omit<ProductivityMember, "name" | "completionRate" | "averageCycleHours"> & {
  cycleHours: number[];
};

type ProductivityAreaEntry = {
  label: string;
  counter: ProductivityCounter;
  members: Map<string, ProductivityCounter>;
  activityEvents: Array<{ at: number; type: "start" | "end" }>;
};

const unassignedOwner = "Sin responsable asignado";

/** Productivity is calculated from production steps, not entire orders. */
export function productivityByArea(orders: Order[], users: AppUser[] = []): AreaProductivity[] {
  const areas = new Map<string, ProductivityAreaEntry>();
  const counter = (): ProductivityCounter => ({ assigned: 0, completed: 0, active: 0, pending: 0, blocked: 0, cycleHours: [] });

  const addStep = (target: ProductivityCounter, step: Order["steps"][number]) => {
    target.assigned += 1;
    if (step.status === "done") target.completed += 1;
    if (step.status === "active") target.active += 1;
    if (step.status === "pending") target.pending += 1;
    if (step.status === "blocked") target.blocked += 1;
    if (step.startedAt && step.completedAt) {
      const elapsed = workshopHoursBetween(step.startedAt, step.completedAt);
      if (Number.isFinite(elapsed)) target.cycleHours.push(elapsed);
    }
  };

  for (const order of orders.filter(isProductionOrder)) {
    for (const step of order.steps) {
      const area: ProductivityAreaEntry = areas.get(step.key) ?? {
        label: step.label,
        counter: counter(),
        members: new Map(),
        activityEvents: [],
      };
      areas.set(step.key, area);
      const owner = step.owner?.trim() || unassignedOwner;
      const member = area.members.get(owner) ?? counter();
      area.members.set(owner, member);
      addStep(area.counter, step);
      addStep(member, step);
      if (step.startedAt) area.activityEvents.push({ at: new Date(step.startedAt).getTime(), type: "start" });
      if (step.completedAt) area.activityEvents.push({ at: new Date(step.completedAt).getTime(), type: "end" });
    }
  }

  // Show roster members who have not received a step yet, too.
  for (const user of users.filter((user) => user.active && user.role === "operator")) {
    for (const areaKey of user.areas?.length ? user.areas : user.area ? [user.area] : []) {
      const area = areas.get(areaKey);
      if (area && !area.members.has(user.name)) area.members.set(user.name, counter());
    }
  }

  const present = (values: ProductivityCounter): Omit<ProductivityMember, "name"> => ({
    assigned: values.assigned,
    completed: values.completed,
    active: values.active,
    pending: values.pending,
    blocked: values.blocked,
    completionRate: values.assigned ? Math.round((values.completed / values.assigned) * 100) : 0,
    averageCycleHours: values.cycleHours.length
      ? values.cycleHours.reduce((total, hours) => total + hours, 0) / values.cycleHours.length
      : undefined,
  });

  const averageIdleHours = (events: Array<{ at: number; type: "start" | "end" }>) => {
    const validEvents = events.filter((event) => Number.isFinite(event.at)).sort((a, b) =>
      a.at - b.at || (a.type === "end" ? -1 : 1),
    );
    let active = 0;
    let idleFrom: number | undefined;
    const idlePeriods: number[] = [];

    for (const event of validEvents) {
      if (event.type === "start") {
        if (active === 0 && idleFrom !== undefined && event.at >= idleFrom) {
          idlePeriods.push(workshopHoursBetween(new Date(idleFrom), new Date(event.at)));
        }
        active += 1;
      } else if (active > 0) {
        active -= 1;
        if (active === 0) idleFrom = event.at;
      }
    }

    return idlePeriods.length
      ? idlePeriods.reduce((total, hours) => total + hours, 0) / idlePeriods.length
      : undefined;
  };

  return Array.from(areas.entries())
    .map(([key, area]) => ({
      key,
      label: area.label,
      ...present(area.counter),
      averageIdleHours: averageIdleHours(area.activityEvents),
      members: Array.from(area.members.entries())
        .map(([name, values]) => ({ name, ...present(values) }))
        .sort((a, b) => b.completed - a.completed || b.assigned - a.assigned || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.blocked - a.blocked || b.active - a.active || a.label.localeCompare(b.label));
}
