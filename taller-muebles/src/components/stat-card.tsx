import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone?: "neutral" | "blue" | "amber" | "rose" | "emerald";
};

const tones = {
  neutral: "border-stone-200 bg-white text-stone-900",
  blue: "border-blue-200 bg-blue-50 text-blue-900",
  amber: "border-amber-200 bg-amber-50 text-amber-950",
  rose: "border-rose-200 bg-rose-50 text-rose-950",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
};

export function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "neutral",
}: StatCardProps) {
  return (
    <section className={cn("rounded-lg border p-4", tones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-current/55">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="rounded-md border border-current/10 bg-white/65 p-2">
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-3 text-sm text-current/65">{helper}</p>
    </section>
  );
}
