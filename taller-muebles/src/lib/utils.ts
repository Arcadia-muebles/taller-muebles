import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Order, StockLocation } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string | null) {
  const date = parseDate(value);
  if (!date) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value?: string) {
  if (!value) return "Sin registro";
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(normalized));
}

export function durationLabel(start?: string, end?: string) {
  if (!start || !end) return "Sin duracion";
  const minutes = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours < 24) return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days}d ${restHours}h` : `${days}d`;
}

export function daysUntil(value?: string | null) {
  const target = parseDate(value);
  if (!target) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function deliveryLabel(value: string | undefined | null, completed: boolean) {
  if (completed) return "Listo";
  const days = daysUntil(value);
  if (!Number.isFinite(days)) return "Sin fecha";
  if (days < 0) return `Vencido ${Math.abs(days)}d`;
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  return `${days}d`;
}

export function priorityFromDeliveryDate(
  value: string | undefined | null,
  options: { urgentDays?: number; upcomingDays?: number } = {},
): Order["priority"] {
  const days = daysUntil(value);
  if (!Number.isFinite(days)) return "normal";
  const urgentDays = options.urgentDays ?? 2;
  const upcomingDays = options.upcomingDays ?? 7;
  if (days <= urgentDays) return "critical";
  if (days <= upcomingDays) return "high";
  return "normal";
}

export function priorityLabel(priority: Order["priority"]) {
  const labels: Record<Order["priority"], string> = {
    normal: "Normal",
    high: "Alta",
    critical: "Crítica",
  };
  return labels[priority];
}

export function hasMeaningfulObservations(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return Boolean(normalized && normalized !== "sin observaciones.");
}

export function stockLocationLabel(location: StockLocation) {
  return location === "warehouse" ? "Bodega" : "Taller";
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}
