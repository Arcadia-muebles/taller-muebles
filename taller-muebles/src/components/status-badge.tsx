import { AlertTriangle, CheckCircle2, Circle, Clock, PauseCircle } from "lucide-react";
import type { Order, OrderStatus, StepStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type StatusBadgeProps =
  | { type: "order"; value: OrderStatus; order?: Order; className?: string }
  | { type: "step"; value: StepStatus; className?: string };

export function StatusBadge(props: StatusBadgeProps) {
  let label = "";
  let badgeStyle = "";
  let Icon: React.ElementType = Clock;

  if (props.type === "order") {
    const order = props.order;
    const status = order?.status ?? props.value;
    const steps = order?.steps ?? [];
    const blockedStep = steps.find((s) => s.status === "blocked");
    const activeStep = steps.find((s) => s.status === "active");

    if (status === "completed") {
      label = "Terminada";
      badgeStyle = "border-emerald-200 bg-emerald-50 text-emerald-700";
      Icon = CheckCircle2;
    } else if (status === "cancelled") {
      label = "Cancelada";
      badgeStyle = "border-stone-200 bg-stone-100 text-stone-600";
      Icon = PauseCircle;
    } else if (status === "blocked" || blockedStep) {
      label = "Bloqueada";
      badgeStyle = "border-rose-200/50 bg-rose-50 text-rose-700";
      Icon = AlertTriangle;
    } else if (activeStep) {
      if (activeStep.key === "cutting") {
        label = "En corte";
        badgeStyle = "border-orange-200/50 bg-orange-50 text-orange-600";
        Icon = Clock;
      } else if (activeStep.key === "quality") {
        label = "En calidad";
        badgeStyle = "border-violet-200/50 bg-violet-50 text-violet-700";
        Icon = CheckCircle2;
      } else {
        label = "En producción";
        badgeStyle = "border-blue-200/50 bg-blue-50 text-blue-700";
        Icon = Clock;
      }
    } else {
      label = "En producción";
      badgeStyle = "border-blue-200/50 bg-[#EFF6FF] text-[#2563EB]";
      Icon = Clock;
    }
  } else {
    // Para etapas individuales
    const val = props.value;
    if (val === "pending") {
      label = "Pendiente";
      badgeStyle = "border-stone-200 bg-white text-stone-500";
      Icon = Circle;
    } else if (val === "active") {
      label = "Activo";
      badgeStyle = "border-blue-200 bg-blue-50 text-blue-700";
      Icon = Clock;
    } else if (val === "done") {
      label = "Listo";
      badgeStyle = "border-emerald-200 bg-emerald-50 text-emerald-700";
      Icon = CheckCircle2;
    } else if (val === "blocked") {
      label = "Bloqueado";
      badgeStyle = "border-rose-200 bg-rose-50 text-rose-700";
      Icon = PauseCircle;
    }
  }

  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold select-none",
        badgeStyle,
        props.className,
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}
