import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OrderForm } from "@/components/order-form";
import { requireSession } from "@/lib/auth";
import { nextOrderCodeForStore } from "@/lib/order-codes";
import { listOrders } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import type { CommercialDocumentType } from "@/lib/types";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const user = await requireSession(["admin", "manager"]);
  const settings = await getSystemSettings();
  if (user.role === "manager" && !settings.permissions.managersCanEditOrders) redirect("/admin");
  const requestedType = (await searchParams).type;
  const initialDocumentType = commercialDocumentType(Array.isArray(requestedType) ? requestedType[0] : requestedType);
  const isQuote = initialDocumentType === "quote";
  const orders = await listOrders();
  const nextCodes = {
    LH: nextOrderCodeForStore("LH", orders.map((order) => order.code)),
    LR: nextOrderCodeForStore("LR", orders.map((order) => order.code)),
  };

  return (
    <AppShell active="admin" user={user}>
      <header className="border-b border-stone-200 pb-5">
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
          {isQuote ? "Nueva cotización" : "Agregar producto"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          {isQuote
            ? "Prepara una cotización comercial sin ingresar sus productos a producción."
            : "En Leather House se registra sólo la información necesaria para producción. En La Reina se crea el documento comercial."}
        </p>
      </header>

      <div className="mt-5 max-w-5xl">
        <OrderForm nextCodes={nextCodes} initialDocumentType={initialDocumentType} />
      </div>
    </AppShell>
  );
}

function commercialDocumentType(value?: string): CommercialDocumentType {
  return ["sales_note", "quote", "purchase_order", "warranty"].includes(value ?? "")
    ? value as CommercialDocumentType
    : "sales_note";
}
