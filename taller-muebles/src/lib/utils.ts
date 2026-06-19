import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string | null) {
  if (!value) return "Sin fecha estimada";
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(normalized));
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
  return minutesLabel(minutes);
}

export function totalDurationLabel(step: { status?: string; startedAt?: string; completedAt?: string; workSessions?: Array<{ startedAt: string; completedAt?: string }> }) {
  const sessions = stepWorkSessions(step);
  const totalMinutes = sessions.reduce((total, session) => {
    const end = session.completedAt ?? (step.completedAt ? step.completedAt : step.status === "active" ? new Date().toISOString() : undefined);
    if (!session.startedAt || !end) return total;
    return total + Math.max(0, Math.round((new Date(end).getTime() - new Date(session.startedAt).getTime()) / 60000));
  }, 0);
  return totalMinutes ? minutesLabel(totalMinutes) : "Sin duracion";
}

export function stepWorkSessions(step: { startedAt?: string; completedAt?: string; workSessions?: Array<{ startedAt: string; completedAt?: string }> }) {
  if (step.workSessions?.length) return step.workSessions;
  if (!step.startedAt) return [];
  return [{ startedAt: step.startedAt, completedAt: step.completedAt }];
}

function minutesLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours < 24) return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days}d ${restHours}h` : `${days}d`;
}

export function daysUntil(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const target = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function deliveryLabel(value: string | undefined | null, completed: boolean) {
  if (completed) return "Listo";
  if (!value) return "Sin fecha";
  const days = daysUntil(value);
  if (days < 0) return `Vencido ${Math.abs(days)}d`;
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  return `${days}d`;
}
