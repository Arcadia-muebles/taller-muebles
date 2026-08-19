import "server-only";

import { clientPortalKey, hasSharedClientIdentity } from "@/lib/client-portal-identity";
import { hasSupabaseConfig } from "@/lib/env";
import { listLocalClientPortalLinks, listLocalOrders } from "@/lib/local-store";
import { createClient } from "@/lib/supabase/server";
import type { ClientPortalLink, OrderStatus, StoreCode } from "@/lib/types";

export type ClientPortalManagementLink = {
  id: string;
  orderId: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  revokedAt?: string;
  status: "active" | "expired" | "revoked";
  expiringSoon: boolean;
};

export type ClientPortalManagementClient = {
  clientKey: string;
  name: string;
  identityLabel: string;
  scope: "customer" | "order";
  anchorOrderId: string;
  documents: Array<{
    code: string;
    store: StoreCode;
    deliveryDate: string;
    status: OrderStatus;
    itemCount: number;
  }>;
  activeLink?: ClientPortalManagementLink;
  latestLink?: ClientPortalManagementLink;
};

export type ClientPortalManagementSnapshot = {
  clients: ClientPortalManagementClient[];
  loadError: boolean;
};

type ManagementOrderRow = {
  id: string;
  internal_code: string;
  group_code: string | null;
  store_id: string;
  client_name: string;
  customer_rut: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  document_type: string;
  product_name: string;
  status: OrderStatus;
  entry_date: string;
  delivery_date: string | null;
  stores: { code: string } | null;
};

type ManagementLinkRow = {
  id: string;
  order_id: string;
  client_key: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  revoked_at: string | null;
};

export async function getClientPortalManagementSnapshot(): Promise<ClientPortalManagementSnapshot> {
  if (!hasSupabaseConfig()) {
    const [orders, links] = await Promise.all([listLocalOrders(), listLocalClientPortalLinks()]);
    const rows: ManagementOrderRow[] = orders.map((order) => ({
      id: order.id,
      internal_code: order.code,
      group_code: order.groupCode ?? null,
      store_id: order.store,
      client_name: order.client,
      customer_rut: order.customerRut ?? null,
      customer_email: order.customerEmail ?? null,
      customer_phone: order.customerPhone ?? null,
      document_type: order.documentType,
      product_name: order.product,
      status: order.status,
      entry_date: order.entryDate,
      delivery_date: order.deliveryDate,
      stores: { code: order.store },
    }));
    return { clients: buildClients(rows, links.map(mapLocalLink)), loadError: false };
  }

  const supabase = await createClient();
  const [ordersResult, linksResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, internal_code, group_code, store_id, client_name, customer_rut, customer_email, customer_phone, document_type, product_name, status, entry_date, delivery_date, stores:store_id(code)")
      .neq("document_type", "quote")
      .order("entry_date", { ascending: false }),
    supabase
      .from("client_portal_links")
      .select("id, order_id, client_key, created_at, updated_at, expires_at, revoked_at")
      .order("created_at", { ascending: false }),
  ]);

  if (ordersResult.error || linksResult.error) {
    console.error("Client portal management query failed:", ordersResult.error?.message ?? linksResult.error?.message);
    return { clients: [], loadError: true };
  }

  return {
    clients: buildClients(
      (ordersResult.data ?? []) as unknown as ManagementOrderRow[],
      (linksResult.data ?? []) as unknown as ManagementLinkRow[],
    ),
    loadError: false,
  };
}

function buildClients(orderRows: ManagementOrderRow[], linkRows: ManagementLinkRow[]) {
  const groups = new Map<string, ManagementOrderRow[]>();
  for (const order of orderRows.filter((item) => item.document_type !== "quote")) {
    const key = keyForRow(order);
    groups.set(key, [...(groups.get(key) ?? []), order]);
  }

  const linksByClient = new Map<string, ManagementLinkRow[]>();
  for (const link of linkRows) {
    linksByClient.set(link.client_key, [...(linksByClient.get(link.client_key) ?? []), link]);
  }

  const now = new Date().toISOString();
  return [...groups.entries()]
    .map(([clientKey, orders]) => {
      const sortedOrders = [...orders].sort((a, b) => b.entry_date.localeCompare(a.entry_date));
      const links = [...(linksByClient.get(clientKey) ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
      const mappedLinks = links.map((link) => mapLink(link, now));
      return {
        clientKey,
        name: sortedOrders[0].client_name,
        identityLabel: identityLabel(clientKey, sortedOrders[0]),
        scope: hasSharedClientIdentity(clientKey) ? "customer" as const : "order" as const,
        anchorOrderId: sortedOrders[0].id,
        documents: mapDocuments(sortedOrders),
        activeLink: mappedLinks.find((link) => link.status === "active"),
        latestLink: mappedLinks[0],
      };
    })
    .sort((a, b) => {
      if (Boolean(a.activeLink) !== Boolean(b.activeLink)) return a.activeLink ? -1 : 1;
      return a.name.localeCompare(b.name, "es-CL");
    });
}

function mapDocuments(orders: ManagementOrderRow[]) {
  const documents = new Map<string, ManagementOrderRow[]>();
  for (const order of orders) {
    const code = order.group_code || order.internal_code;
    const key = `${order.store_id}:${code}`;
    documents.set(key, [...(documents.get(key) ?? []), order]);
  }

  return [...documents.values()]
    .map((items) => {
      const first = items[0];
      const deliveryDate = [...items]
        .map((item) => item.delivery_date ?? item.entry_date)
        .sort((a, b) => b.localeCompare(a))[0];
      return {
        code: first.group_code || first.internal_code,
        store: (first.stores?.code ?? first.store_id) as StoreCode,
        deliveryDate,
        status: documentStatus(items.map((item) => item.status)),
        itemCount: items.length,
      };
    })
    .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate));
}

function mapLocalLink(link: ClientPortalLink): ManagementLinkRow {
  return {
    id: link.id,
    order_id: link.orderId,
    client_key: link.clientKey,
    created_at: link.createdAt,
    updated_at: link.updatedAt ?? link.createdAt,
    expires_at: link.expiresAt,
    revoked_at: link.revokedAt ?? null,
  };
}

function mapLink(link: ManagementLinkRow, now: string): ClientPortalManagementLink {
  const status = link.revoked_at ? "revoked" : link.expires_at <= now ? "expired" : "active";
  const daysRemaining = (new Date(link.expires_at).getTime() - new Date(now).getTime()) / 86_400_000;
  return {
    id: link.id,
    orderId: link.order_id,
    createdAt: link.created_at,
    updatedAt: link.updated_at,
    expiresAt: link.expires_at,
    revokedAt: link.revoked_at ?? undefined,
    status,
    expiringSoon: status === "active" && daysRemaining <= 14,
  };
}

function keyForRow(row: ManagementOrderRow) {
  return clientPortalKey({
    store: row.store_id,
    code: row.internal_code,
    groupCode: row.group_code,
    customerRut: row.customer_rut,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
  });
}

function identityLabel(clientKey: string, order: ManagementOrderRow) {
  if (clientKey.startsWith("rut:")) return `RUT ${clientKey.slice(4)}`;
  if (clientKey.startsWith("email:")) return clientKey.slice(6);
  if (clientKey.startsWith("phone:")) return `Tel. ${clientKey.slice(6)}`;
  return `Sólo nota ${order.group_code || order.internal_code}`;
}

function documentStatus(statuses: OrderStatus[]): OrderStatus {
  if (statuses.every((status) => status === "completed")) return "completed";
  if (statuses.every((status) => status === "cancelled")) return "cancelled";
  if (statuses.includes("blocked")) return "blocked";
  if (statuses.includes("urgent")) return "urgent";
  if (statuses.includes("quality_control")) return "quality_control";
  if (statuses.includes("in_production")) return "in_production";
  return statuses[0] ?? "scheduled";
}
