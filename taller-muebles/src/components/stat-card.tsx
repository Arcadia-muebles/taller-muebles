import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone?: "neutral" | "blue" | "amber" | "rose" | "emerald";
  diff?: string;
  diffType?: "up-green" | "up-red" | "down-green" | "neutral";
};

const toneStyles = {
  neutral: "bg-stone-50 text-stone-500 border-stone-200/60",
  blue: "bg-[#EFF6FF] text-[#2563EB] border-blue-200/40",
  amber: "bg-orange-50 text-orange-600 border-orange-200/40",
  rose: "bg-red-50 text-red-600 border-red-200/40",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-200/40",
};

export function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "neutral",
  diff,
  diffType = "neutral",
}: StatCardProps) {
  return (
    <section className="rounded-2xl border border-stone-200/60 bg-white p-5 flex flex-col justify-between shadow-sm select-none hover:shadow-md transition-shadow duration-200">
      <div>
        {/* Header: Label y Icono */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-stone-500">
            {label}
          </p>
          <div className={`grid size-8 place-items-center rounded-lg border ${toneStyles[tone]}`}>
            <Icon className="size-4" />
          </div>
        </div>

        {/* Valor y Diferencia */}
        <div className="mt-3 flex items-baseline gap-2.5">
          <span className="text-[34px] font-serif font-bold text-stone-900 leading-none">
            {value}
          </span>
          {diff ? (
            <span className={`inline-flex items-center text-[11px] font-bold ${
              diffType === "up-green" || diffType === "down-green" ? "text-emerald-600" :
              diffType === "up-red" ? "text-orange-600" : "text-stone-400"
            }`}>
              {diff}
              {diffType === "up-green" && " ↗"}
              {diffType === "up-red" && " ↗"}
              {diffType === "down-green" && " ↘"}
            </span>
          ) : null}
        </div>
      </div>

      {/* Helper text en el footer de la tarjeta */}
      <p className="mt-4 text-[11px] text-stone-400 font-medium leading-normal">
        {helper}
      </p>
    </section>
  );
}
