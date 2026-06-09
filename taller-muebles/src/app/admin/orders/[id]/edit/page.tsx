import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OrderForm } from "@/components/order-form";
import { requireSession } from "@/lib/auth";
import { getOrder, listUsers } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import { redirect } from "next/navigation";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession(["admin", "manager"]);
  const { id } = await params;
  const [order, settings, users] = await Promise.all([getOrder(id), getSystemSettings(), listUsers()]);
  if (user.role === "manager" && !settings.permissions.managersCanEditOrders) redirect(`/admin/orders/${id}`);
  if (!order) notFound();

  return (
    <AppShell active="admin" user={user}>
      <header className="border-b border-stone-200 pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">Editar orden</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{order.code}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          Actualiza datos comerciales y de planificación sin perder el avance productivo.
        </p>
      </header>
      <div className="mt-5 max-w-5xl">
        <OrderForm
          orderId={order.id}
          assignees={Array.from(new Set([order.assignedTo, ...users.filter((item) => item.active && item.role === "operator").map((item) => item.name)]))}
          initialValues={{
            store: order.store,
            salesNoteNumber: order.code,
            clientName: order.client,
            productName: order.product,
            material: order.material,
            color: order.color,
            entryDate: order.entryDate,
            deliveryDate: order.deliveryDate,
            priority: order.priority,
            assignedTo: order.assignedTo,
            observations: order.observations,
            isWarranty: order.isWarranty,
          }}
        />
      </div>
    </AppShell>
  );
}
