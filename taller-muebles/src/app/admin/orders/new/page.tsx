import { AppShell } from "@/components/app-shell";
import { OrderForm } from "@/components/order-form";
import { requireSession } from "@/lib/auth";
import type { StoreCode } from "@/lib/types";
import { getSystemSettings } from "@/lib/repositories/settings";
import { redirect } from "next/navigation";
import { listOrders } from "@/lib/repositories/production";

export default async function NewOrderPage() {
  const user = await requireSession(["admin", "manager"]);
  const settings = await getSystemSettings();
  if (user.role === "manager" && !settings.permissions.managersCanEditOrders) redirect("/admin");
  const orders = await listOrders();
  const nextCodes = {
    LH: nextCodeForStore("LH", orders.map((order) => order.code)),
    LR: nextCodeForStore("LR", orders.map((order) => order.code)),
  };

  return (
    <AppShell active="admin" user={user}>
      <header className="border-b border-stone-200 pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
          Nueva nota
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
          Crear orden de producción
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          Esta pantalla concentra los datos que antes quedaban repartidos entre
          hojas: venta, cliente, producto, fechas, prioridad y primera asignación.
        </p>
      </header>

      <div className="mt-5 max-w-5xl">
        <OrderForm nextCodes={nextCodes} />
      </div>
    </AppShell>
  );
}

function nextCodeForStore(store: StoreCode, codes: string[]) {
  const max = codes.reduce((current, code) => {
    const match = new RegExp(`^${store}-?(\\d+)$`).exec(code);
    if (!match) return current;
    return Math.max(current, Number(match[1]));
  }, 0);
  return `${store}-${String(max + 1).padStart(2, "0")}`;
}
