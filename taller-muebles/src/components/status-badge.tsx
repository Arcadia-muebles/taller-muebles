import { AlertTriangle, CheckCircle2, Circle, Clock, PauseCircle } from "lucide-react";
import type { OrderStatus, StepStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const orderConfig: Record<
  OrderStatus,
  { label: string; className: string; icon: React.ElementType }
> = {
  draft: {
    label: "Borrador",
    className: "border-stone-200 bg-white text-stone-600",
    icon: Circle,
  },
  scheduled: {
    label: "Programada",
    className: "border-stone-200 bg-white text-stone-600",
    icon: Clock,
  },
  in_production: {
    label: "En producción",
    className: "border-stone-300 bg-stone-50 text-stone-800",
    icon: Clock,
  },
  blocked: {
    label: "Bloqueada",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    icon: PauseCircle,
  },
  urgent: {
    label: "Urgente",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: AlertTriangle,
  },
  quality_control: {
    label: "Calidad",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: CheckCircle2,
  },
  completed: {
    label: "Despachada",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelada",
    className: "border-stone-200 bg-stone-100 text-stone-600",
    icon: PauseCircle,
  },
};

const stepConfig: Record<
  StepStatus,
  { label: string; className: string; icon: React.ElementType }
> = {
  pending: {
    label: "Pendiente",
    className: "border-stone-200 bg-white text-stone-500",
    icon: Circle,
  },
  active: {
    label: "Activo",
    className: "border-stone-300 bg-stone-50 text-stone-800",
    icon: Clock,
  },
  done: {
    label: "Listo",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  blocked: {
    label: "Bloqueado",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    icon: PauseCircle,
  },
};

type StatusBadgeProps =
  | { type: "order"; value: OrderStatus; className?: string }
  | { type: "step"; value: StepStatus; className?: string };

export function StatusBadge(props: StatusBadgeProps) {
  const config =
    props.type === "order" ? orderConfig[props.value] : stepConfig[props.value];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium",
        config.className,
        props.className,
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{config.label}</span>
    </span>
  );
}
