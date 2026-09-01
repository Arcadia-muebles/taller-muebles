import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OrderForm } from "@/components/order-form";
import { requireModuleAccess } from "@/lib/auth";
import { canEditCommercial } from "@/lib/module-access";
import { compareOrderGroupMembers, orderGroupKey } from "@/lib/orders";
import { getOrder, listOrders, listUsers } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import { redirect } from "next/navigation";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModuleAccess("commercial");
  const { id } = await params;
  const [order, settings, users, orders] = await Promise.all([getOrder(id), getSystemSettings(), listUsers(), listOrders()]);
  if (!canEditCommercial(user, settings.permissions.managersCanEditOrders)) redirect(`/admin/orders/${id}`);
  if (!order) notFound();
  if (user.role === "operator" && order.documentType === "production_intake") redirect("/admin/documents");
  const groupOrders = orders
    .filter((item) => orderGroupKey(item) === orderGroupKey(order))
    .sort(compareOrderGroupMembers);
  const documentOrder = groupOrders[0] ?? order;

  return (
    <AppShell active="admin" user={user}>
      <header className="border-b border-stone-200 pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">Editar orden</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{documentOrder.groupCode || documentOrder.code}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          Actualiza datos comerciales y de planificación sin perder el avance productivo.
        </p>
      </header>
      <div className="mt-5 max-w-5xl">
        <OrderForm
          orderId={documentOrder.id}
          commercialOnly={user.role === "operator"}
          assignees={Array.from(new Set([documentOrder.assignedTo, ...users.filter((item) => item.active && item.role === "operator").map((item) => item.name)]))}
          initialValues={{
            store: documentOrder.store,
            documentType: documentOrder.documentType,
            documentStatus: documentOrder.documentStatus,
            salesNoteNumber: documentOrder.code,
            groupCode: documentOrder.groupCode,
            clientName: documentOrder.client,
            customerContact: documentOrder.customerContact,
            customerAddress: documentOrder.customerAddress,
            customerCommune: documentOrder.customerCommune,
            customerRut: documentOrder.customerRut,
            customerEmail: documentOrder.customerEmail,
            customerPhone: documentOrder.customerPhone,
            productName: documentOrder.product,
            material: documentOrder.material,
            color: documentOrder.color,
            quantity: documentOrder.quantity,
            unitPrice: documentOrder.unitPrice,
            subtotal: documentOrder.subtotal,
            discount: documentOrder.discount,
            total: documentOrder.total,
            includesVat: documentOrder.includesVat,
            paidAmount: documentOrder.paidAmount,
            sellerName: documentOrder.sellerName,
            paymentMethod: documentOrder.paymentMethod,
            deliveryTerms: documentOrder.deliveryTerms,
            entryDate: documentOrder.entryDate,
            deliveryDate: documentOrder.deliveryDate,
            assignedTo: documentOrder.assignedTo,
            observations: documentOrder.observations,
            isWarranty: documentOrder.isWarranty,
            products: groupOrders.map((item) => ({
              productName: item.product,
              material: item.material,
              color: item.color,
              quantity: item.quantity ?? 1,
              unitPrice: item.unitPrice ?? 0,
            })),
            payments: (documentOrder.payments ?? []).map((payment) => ({
              id: payment.id,
              paidAt: payment.paidAt,
              amount: payment.amount,
              method: payment.method,
              note: payment.note ?? "",
            })),
          }}
        />
      </div>
    </AppShell>
  );
}
