import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OrderForm } from "@/components/order-form";
import { requireSession } from "@/lib/auth";
import { nextOrderCodeForStore } from "@/lib/order-codes";
import { listOrders } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";

export default async function NewOrderPage() {
  const user = await requireSession(["admin", "manager"]);
  const settings = await getSystemSettings();
  if (user.role === "manager" && !settings.permissions.managersCanEditOrders) redirect("/admin");
  const orders = await listOrders();
  const nextCodes = {
    LH: nextOrderCodeForStore("LH", orders.map((order) => order.code)),
    LR: nextOrderCodeForStore("LR", orders.map((order) => order.code)),
  };

  return (
    <AppShell active="admin" user={user}>
      <header className="border-b border-stone-200 pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
          Nuevo documento
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
          Crear documento La Reina
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          El flujo principal emite documentos de Muebles La Reina y alimenta producción.
          Leather House queda disponible como ingreso simplificado de fabricacion.
        </p>
      </header>

      <div className="mt-5 max-w-5xl">
        <OrderForm nextCodes={nextCodes} />
      </div>
    </AppShell>
  );
}
