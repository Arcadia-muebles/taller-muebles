import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Order, StockLocation } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string | null) {
  const date = parseDate(value);
  if (!date) return "Sin fecha";
  return normalizeDateLabel(new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Santiago",
  }).format(date));
}

export function formatDateTime(value?: string) {
  if (!value) return "Sin registro";
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  return normalizeDateLabel(new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
  }).format(new Date(normalized)));
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

const workshopTimeZone = "America/Santiago";

/**
 * Returns elapsed time only inside the workshop schedule:
 * Mon-Fri 09:00-13:00 and 14:00-18:00; Sat 09:00-13:00.
 */
export function workshopHoursBetween(start?: string | Date, end?: string | Date) {
  const startDate = toValidDate(start);
  const endDate = toValidDate(end);
  if (!startDate || !endDate || endDate <= startDate) return 0;

  const firstDay = zonedDateParts(startDate);
  const lastDay = zonedDateParts(endDate);
  const cursor = new Date(Date.UTC(firstDay.year, firstDay.month - 1, firstDay.day));
  const lastCursor = Date.UTC(lastDay.year, lastDay.month - 1, lastDay.day);
  let totalMilliseconds = 0;

  while (cursor.getTime() <= lastCursor) {
    const day = cursor.getUTCDay();
    const slots = day >= 1 && day <= 5
      ? [[9, 13], [14, 18]]
      : day === 6
        ? [[9, 13]]
        : [];
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    const date = cursor.getUTCDate();

    for (const [fromHour, toHour] of slots) {
      const slotStart = zonedDateTimeToUtc(year, month, date, fromHour).getTime();
      const slotEnd = zonedDateTimeToUtc(year, month, date, toHour).getTime();
      totalMilliseconds += Math.max(0, Math.min(endDate.getTime(), slotEnd) - Math.max(startDate.getTime(), slotStart));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return totalMilliseconds / 3_600_000;
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

function toValidDate(value?: string | Date) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function zonedDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: workshopTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function zonedDateTimeToUtc(year: number, month: number, day: number, hour: number) {
  const utcGuess = Date.UTC(year, month - 1, day, hour);
  const guess = new Date(utcGuess);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: workshopTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(guess);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const localAsUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  return new Date(utcGuess - (localAsUtc - utcGuess));
}

function normalizeDateLabel(value: string) {
  return value.replace(/\u00a0/g, " ");
}
