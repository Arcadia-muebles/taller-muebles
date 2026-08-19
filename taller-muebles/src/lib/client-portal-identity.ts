import type { Order } from "@/lib/types";

type ClientIdentityOrder = Pick<
  Order,
  "store" | "code" | "groupCode" | "customerRut" | "customerEmail" | "customerPhone"
>;

export function clientPortalKeyForOrder(order: ClientIdentityOrder) {
  return clientPortalKey({
    store: order.store,
    code: order.code,
    groupCode: order.groupCode,
    customerRut: order.customerRut,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
  });
}

export function clientPortalKey(input: {
  store: string;
  code: string;
  groupCode?: string | null;
  customerRut?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
}) {
  const rut = normalizeRut(input.customerRut);
  if (rut.length >= 8) return `rut:${rut}`;

  const email = input.customerEmail?.trim().toLocaleLowerCase("es-CL");
  if (email) return `email:${email}`;

  const phone = input.customerPhone?.replace(/[^0-9]/g, "") ?? "";
  if (phone.length >= 8) return `phone:${phone}`;

  const documentCode = input.groupCode?.trim() || input.code.trim();
  return `order:${input.store}:${documentCode}`;
}

export function hasSharedClientIdentity(clientKey: string) {
  return !clientKey.startsWith("order:");
}

function normalizeRut(value?: string | null) {
  return value?.toUpperCase().replace(/[^0-9K]/g, "") ?? "";
}
