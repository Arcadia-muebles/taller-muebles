import type { StockItem } from "@/lib/types";
import Link from "next/link";
import { cn } from "@/lib/utils";

type StockPanelProps = {
  items: StockItem[];
};

function MaterialPreview({ name }: { name: string }) {
  const lower = name.toLowerCase();
  let bgClass = "bg-stone-200 border-stone-300";
  
  if (lower.includes("cuero")) {
    bgClass = "bg-[#8B5A2B] border-[#78350F]/20";
  } else if (lower.includes("espuma")) {
    bgClass = "bg-[#FEF3C7] border-[#FDE68A]/35";
  } else if (lower.includes("hilo")) {
    bgClass = "bg-[#E6D9C8] border-[#D1C2AF]/35 rounded-full";
  } else if (lower.includes("patas") || lower.includes("madera")) {
    bgClass = "bg-[#A16207] border-[#78350F]/20";
  } else if (lower.includes("cierre")) {
    bgClass = "bg-stone-500 border-stone-600/30";
  }

  return (
    <div className={cn("size-8 rounded-lg shrink-0 border shadow-inner select-none", bgClass)} />
  );
}

export function StockPanel({ items }: StockPanelProps) {
  // Filtrar ítems críticos
  const criticalItems = items.filter((item) => item.available <= item.minimum);
  const displayItems = criticalItems.slice(0, 5);

  return (
    <section className="rounded-2xl border border-stone-200/60 bg-white p-5 shadow-sm shadow-stone-100/30 flex flex-col justify-between select-none h-full">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-serif font-medium text-stone-900">Stock crítico</h2>
            <p className="text-xs text-stone-400 font-semibold mt-1">Materiales y componentes con inventario bajo</p>
          </div>
          <Link href="/admin/stock" className="text-xs font-bold text-[#9E7A5A] hover:underline">
            Ver stock
          </Link>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="pb-2 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400">Material</th>
                <th className="pb-2 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400">Disponibilidad</th>
                <th className="pb-2 text-right text-[10px] font-bold uppercase tracking-widest text-stone-400">Riesgo</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item) => {
                const ratio = item.available / item.minimum;
                // Si la disponibilidad es menor al 25% del mínimo, es crítico (Alto)
                const isCritical = ratio <= 0.25 || item.name.toLowerCase().includes("cuero") || item.name.toLowerCase().includes("cierre");
                
                return (
                  <tr key={item.id} className="border-b border-[#FAF6F0] last:border-0 hover:bg-[#FAF6F0]/20 transition">
                    <td className="py-2.5 flex items-center gap-3 text-xs font-bold text-stone-800">
                      <MaterialPreview name={item.name} />
                      <span className="truncate max-w-[140px]">{item.name}</span>
                    </td>
                    <td className="py-2.5 text-xs text-stone-500 font-bold">
                      {item.available} {item.unit}
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${
                        isCritical 
                          ? "bg-rose-50 text-rose-700 border border-rose-200/30 font-bold" 
                          : "bg-amber-50 text-amber-700 border border-amber-250/20 font-bold"
                      }`}>
                        {isCritical ? "Crítico" : "Bajo"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 border-t border-stone-100 pt-3.5">
        <Link href="/admin/stock" className="text-xs font-semibold text-[#9E7A5A] hover:text-stone-850 hover:underline transition inline-flex items-center gap-1">
          Ver todos los materiales &rarr;
        </Link>
      </div>
    </section>
  );
}
