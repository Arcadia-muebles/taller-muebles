import { Boxes, TriangleAlert } from "lucide-react";
import type { StockItem } from "@/lib/types";

type StockPanelProps = {
  items: StockItem[];
};

export function StockPanel({ items }: StockPanelProps) {
  const risky = items.filter((item) => item.available <= item.minimum);

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Stock critico</h2>
          <p className="text-sm text-stone-500">Materiales que pueden frenar producción.</p>
        </div>
        <Boxes className="size-5 text-stone-400" />
      </div>

      <div className="mt-4 space-y-3">
        {risky.map((item) => (
          <div
            key={item.id}
            className="flex min-w-0 flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-center gap-3">
              <TriangleAlert className="size-4 shrink-0 text-amber-700" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-amber-950">{item.name}</p>
                <p className="text-xs text-amber-800">
                  Mínimo {item.minimum} {item.unit}
                </p>
              </div>
            </div>
            <p className="text-sm font-semibold text-amber-950">
              {item.available} {item.unit}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
