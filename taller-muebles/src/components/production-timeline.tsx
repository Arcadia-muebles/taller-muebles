import { CircleDot, Timer } from "lucide-react";
import type { Order } from "@/lib/types";
import { areaLoad } from "@/lib/metrics";
import { StatusBadge } from "./status-badge";

type ProductionTimelineProps = {
  orders: Order[];
};

export function ProductionTimeline({ orders }: ProductionTimelineProps) {
  const areas = areaLoad(orders);

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Carga por proceso</h2>
          <p className="text-sm text-stone-500">Lectura rapida de avance y cuellos de botella.</p>
        </div>
        <Timer className="size-5 text-stone-400" />
      </div>

      <div className="mt-5 space-y-4">
        {areas.map((area) => {
          const total = area.active + area.blocked + area.done;
          const activePct = total ? Math.round((area.active / total) * 100) : 0;
          const blockedPct = total ? Math.round((area.blocked / total) * 100) : 0;
          return (
            <div key={area.label}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CircleDot className="size-4 text-stone-400" />
                  <p className="text-sm font-medium">{area.label}</p>
                </div>
                <p className="text-xs text-stone-500">{total} ordenes</p>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-stone-200">
                <div className="bg-blue-500" style={{ width: `${activePct}%` }} />
                <div className="bg-rose-500" style={{ width: `${blockedPct}%` }} />
                <div className="flex-1 bg-emerald-500" />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge type="step" value="active" className="h-6" />
                <span className="text-xs text-stone-500">{area.active}</span>
                <StatusBadge type="step" value="blocked" className="h-6" />
                <span className="text-xs text-stone-500">{area.blocked}</span>
                <StatusBadge type="step" value="done" className="h-6" />
                <span className="text-xs text-stone-500">{area.done}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
