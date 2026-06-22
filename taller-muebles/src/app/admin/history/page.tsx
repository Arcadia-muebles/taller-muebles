import { Archive, CheckCircle2, CircleOff } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { OrderTable } from "@/components/order-table";
import { requireSession } from "@/lib/auth";
import { listOrders } from "@/lib/repositories/production";

export default async function HistoryPage() {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const orders = await listOrders();
  const historical = orders.filter((order) => ["completed", "cancelled"].includes(order.status));
  const completed = historical.filter((order) => order.status === "completed").length;
  const cancelled = historical.filter((order) => order.status === "cancelled").length;

  return (
    <AppShell active="admin" user={user}>
      <header className="border-b border-stone-200 pb-5">
        <p className="page-kicker">Historial</p>
        <h1 className="page-title">Órdenes despachadas y canceladas</h1>
        <p className="page-description max-w-2xl">
          Registro permanente de órdenes que ya no forman parte de la producción activa.
        </p>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <Summary icon={Archive} label="Total histórico" value={historical.length} />
        <Summary icon={CheckCircle2} label="Despachadas" value={completed} tone="emerald" />
        <Summary icon={CircleOff} label="Canceladas" value={cancelled} tone="stone" />
      </section>

      <div className="mt-5">
        <OrderTable
          orders={historical}
          title="Historial de órdenes"
          description={`${historical.length} órdenes despachadas o canceladas.`}
          emptyText="No hay órdenes históricas registradas."
        />
      </div>
    </AppShell>
  );
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
