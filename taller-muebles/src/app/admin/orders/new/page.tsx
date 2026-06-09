import { AppShell } from "@/components/app-shell";
import { OrderForm } from "@/components/order-form";
import { requireSession } from "@/lib/auth";
import { getSystemSettings } from "@/lib/repositories/settings";
import { redirect } from "next/navigation";
import { listUsers } from "@/lib/repositories/production";

export default async function NewOrderPage() {
  const user = await requireSession(["admin", "manager"]);
  const settings = await getSystemSettings();
  if (user.role === "manager" && !settings.permissions.managersCanEditOrders) redirect("/admin");
  const users = await listUsers();
  const assignees = users.filter((item) => item.active && item.role === "operator").map((item) => item.name);

  return (
    <AppShell active="admin" user={user}>
      <header className="border-b border-stone-200 pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
          Nueva nota
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
          Crear orden de produccion
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          Esta pantalla concentra los datos que antes quedaban repartidos entre
          hojas: venta, cliente, producto, fechas, prioridad y primera asignacion.
        </p>
      </header>

      <div className="mt-5 max-w-5xl">
        <OrderForm assignees={assignees} />
      </div>
    </AppShell>
  );
}
