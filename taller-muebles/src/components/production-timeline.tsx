import type { Order } from "@/lib/types";
import { areaLoad } from "@/lib/metrics";

type ProductionTimelineProps = {
  orders: Order[];
};

const areaMeta: Record<string, { label: string; barColor: string; dotColor: string; statusText: string }> = {
  structure: { label: "Diseño y planificación", barColor: "bg-[#8F9779]", dotColor: "bg-emerald-500", statusText: "Activo" },
  cutting: { label: "Corte", barColor: "bg-[#C39F7D]", dotColor: "bg-amber-500", statusText: "En proceso" },
  sewing: { label: "Costura", barColor: "bg-[#3B82F6]/75", dotColor: "bg-blue-500", statusText: "En proceso" },
  upholstery: { label: "Tapizado", barColor: "bg-[#A855F7]/75", dotColor: "bg-violet-500", statusText: "En proceso" },
  quality: { label: "Control calidad", barColor: "bg-[#8B5CF6]/75", dotColor: "bg-indigo-500", statusText: "En revisión" },
};

export function ProductionTimeline({ orders }: ProductionTimelineProps) {
  const activeAreas = areaLoad(orders);
  const allKeys = ["structure", "cutting", "sewing", "upholstery", "quality"];

  return (
    <section className="rounded-2xl border border-stone-200/60 bg-white p-5 shadow-sm shadow-stone-100/30 flex flex-col justify-between select-none h-full">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-serif font-medium text-stone-900">Carga por proceso</h2>
            <p className="text-xs text-stone-400 font-semibold mt-1">Avance por etapa de producción</p>
          </div>
          {/* Selector Hoy */}
          <div className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 text-[11px] font-bold text-stone-600 shadow-sm cursor-pointer hover:bg-stone-50">
            <span>Hoy</span>
            <svg className="size-3 text-stone-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {allKeys.map((key) => {
            const meta = areaMeta[key];
            if (!meta) return null;

            // Buscar datos reales en la base de datos
            const realArea = activeAreas.find((a) => a.label.toLowerCase().includes(meta.label.slice(0, 4).toLowerCase()));
            const count = realArea ? realArea.active + realArea.blocked : 0;
            const pct = count * 20;

            return (
              <div key={key} className="flex items-center justify-between gap-3">
                {/* Etapa y órdenes */}
                <div className="w-40 shrink-0">
                  <p className="text-xs font-bold text-stone-800">{meta.label}</p>
                  <p className="text-[10px] text-stone-400 font-semibold mt-0.5">
                    {count} {count === 1 ? "orden" : "órdenes"}
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-stone-100 border border-stone-250/10">
                  <div className={`h-full rounded-full ${meta.barColor} transition-all duration-300`} style={{ width: `${pct}%` }} />
                </div>

                {/* Estado */}
                <div className="w-24 shrink-0 flex items-center justify-end gap-1.5 text-right">
                  <span className={`size-1.5 rounded-full ${meta.dotColor}`} />
                  <span className="text-[11px] font-bold text-stone-600">{meta.statusText}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
