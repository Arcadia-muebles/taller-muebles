import { Archive, CheckCircle2, CircleOff } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { OrderTable } from "@/components/order-table";
import { requireSession } from "@/lib/auth";
import { listOrders } from "@/lib/repositories/production";

type HistoryPageProps = {
  searchParams: Promise<{
    range?: string;
    month?: string;
  }>;
};

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const filters = await searchParams;
  const orders = await listOrders();
  const allHistorical = orders.filter((order) => ["completed", "cancelled"].includes(order.status));
  const historical = filterHistoricalOrders(allHistorical, filters);
  const completed = historical.filter((order) => order.status === "completed").length;
  const cancelled = historical.filter((order) => order.status === "cancelled").length;
  const selectedMonth = filters.month ?? new Date().toISOString().slice(0, 7);

  return (
    <AppShell active="admin" user={user}>
      <header className="border-b border-stone-200 pb-5">
        <p className="page-kicker">Historial</p>
        <h1 className="page-title">Órdenes despachadas y canceladas</h1>
        <p className="page-description max-w-2xl">
          Registro permanente de órdenes que ya no forman parte de la producción activa.
        </p>
      </header>

      <section className="mt-5 rounded-lg border border-stone-200 bg-white p-4">
        <form className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="grid gap-1.5 text-xs font-medium text-stone-600">
            Mes
            <input type="month" name="month" defaultValue={selectedMonth} className="control bg-white" />
          </label>
          <button type="submit" name="range" value="month" className="btn btn-secondary">
            Filtrar mes
          </button>
          <button type="submit" name="range" value="30d" className="btn btn-secondary">
            Últimos 30 días
          </button>
          <a href="/admin/history" className="btn btn-secondary">
            Todo
          </a>
        </form>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <Summary icon={Archive} label="Total histórico" value={historical.length} />
        <Summary icon={CheckCircle2} label="Despachadas" value={completed} tone="emerald" />
        <Summary icon={CircleOff} label="Canceladas" value={cancelled} tone="stone" />
      </section>

      <div className="mt-5">
        <OrderTable
          orders={historical}
          rowLinks
          hideActions
          title="Historial de órdenes"
          description={`${historical.length} de ${allHistorical.length} órdenes despachadas o canceladas.`}
          emptyText="No hay órdenes históricas registradas."
        />
      </div>
    </AppShell>
  );
}

function filterHistoricalOrders(
  orders: Awaited<ReturnType<typeof listOrders>>,
  filters: { range?: string; month?: string },
) {
  if (filters.range === "30d") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    cutoff.setHours(0, 0, 0, 0);
    return orders.filter((order) => historicalDate(order) >= cutoff);
  }

  if (filters.range === "month" && filters.month && /^\d{4}-\d{2}$/.test(filters.month)) {
    return orders.filter((order) => {
      const date = historicalDate(order);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` === filters.month;
    });
  }

  return orders;
}

function historicalDate(order: Awaited<ReturnType<typeof listOrders>>[number]) {
  const value = order.completedAt ?? order.deliveryDate ?? order.entryDate;
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function Summary({ icon: Icon, label, value, tone = "stone" }: { icon: React.ElementType; label: string; value: number; tone?: "stone" | "emerald" }) {
  return (
    <div className={tone === "emerald" ? "rounded-lg border border-emerald-200 bg-emerald-50 p-4" : "rounded-lg border border-stone-200 bg-white p-4"}>
      <Icon className={tone === "emerald" ? "size-5 text-emerald-700" : "size-5 text-stone-500"} />
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-stone-500">{label}</p>
    </div>
  );
}
