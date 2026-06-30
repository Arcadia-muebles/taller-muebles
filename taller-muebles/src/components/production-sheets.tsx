"use client";

import { Archive, ClipboardList, Columns3 } from "lucide-react";
import { useMemo, useState } from "react";
import { activeOrders } from "@/lib/metrics";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";
import { OrderTable } from "./order-table";
import { ProductionBoard } from "./production-board";

type SheetKey = "all" | "active" | "board";

type ProductionSheetsProps = {
  orders: Order[];
  canEditOrders: boolean;
  steps: Array<{ key: string; label: string; targetDays: number; enabled: boolean; required: boolean }>;
};

export function ProductionSheets({ orders, canEditOrders, steps }: ProductionSheetsProps) {
  const [sheet, setSheet] = useState<SheetKey>("all");
  const active = useMemo(() => activeOrders(orders), [orders]);
  const visibleOrders = sheet === "active" ? active : orders;

  return (
    <section className="mt-5">
      <div className="mb-3 flex flex-col gap-3 border-b border-stone-200 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-kicker">Vista de trabajo</p>
          <h2 className="text-xl font-semibold tracking-tight text-stone-950">Hojas y procesos</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">
            Cambia entre historial completo, notas activas y tablero por proceso sin llenar la pantalla con todas las vistas a la vez.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-stone-200 bg-white p-1">
          <SheetButton
            active={sheet === "all"}
            icon={Archive}
            label="Todas"
            count={orders.length}
            onClick={() => setSheet("all")}
          />
          <SheetButton
            active={sheet === "active"}
            icon={ClipboardList}
            label="Activas"
            count={active.length}
            onClick={() => setSheet("active")}
          />
          <SheetButton
            active={sheet === "board"}
            icon={Columns3}
            label="Procesos"
            count={active.length}
            onClick={() => setSheet("board")}
          />
        </div>
      </div>

      {sheet === "board" ? (
        <ProductionBoard orders={active} allOrders={orders} steps={steps} canMove={canEditOrders} />
      ) : (
        <OrderTable
          orders={visibleOrders}
          canEditOrders={canEditOrders}
          rowLinks
          hideActions
          title={sheet === "active" ? "Notas activas" : "Todas las notas de venta"}
          description={
            sheet === "active"
              ? "Notas pendientes, en producción, atrasadas o sin iniciar. Las terminadas desaparecen de esta hoja."
              : "Historial completo de notas antiguas y nuevas, terminadas y pendientes."
          }
          emptyText={
            sheet === "active"
              ? "No hay notas activas para producción."
              : "No hay notas registradas."
          }
        />
      )}
    </section>
  );
}

function SheetButton({
  active,
  icon: Icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition",
        active ? "bg-stone-950 text-white" : "text-stone-600 hover:bg-stone-50 hover:text-stone-950",
      )}
    >
      <Icon className="size-4" />
      <span>{label}</span>
      <span className={cn("rounded-full px-2 py-0.5 text-xs", active ? "bg-white/15 text-white" : "bg-stone-100 text-stone-500")}>
        {count}
      </span>
    </button>
  );
}
