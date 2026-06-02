import { orders } from "./mock-data";
import type { OrderStatus, StepStatus } from "./types";

export function getOrderById(id: string) {
  return orders.find((order) => order.id === id);
}

export function orderStatusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    draft: "Borrador",
    scheduled: "Programada",
    in_production: "En produccion",
    blocked: "Bloqueada",
    urgent: "Urgente",
    quality_control: "Revision",
    completed: "Terminada",
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
