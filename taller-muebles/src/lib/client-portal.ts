import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { clientPortalKey, clientPortalKeyForOrder, hasSharedClientIdentity } from "@/lib/client-portal-identity";
import type { ClientPortalLink, ClientPortalOrder, Order, OrderStatus, StepStatus, StoreCode } from "@/lib/types";
import { completionPercent } from "@/lib/metrics";
import {
  createLocalClientPortalLink,
  findLocalClientPortalLinkByTokenHash,
  getLocalOrder,
  listLocalOrders,
  revokeLocalClientPortalLinkById,
  updateLocalClientPortalLink,
} from "@/lib/local-store";
import { hasSupabaseConfig } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

const defaultLinkLifetimeDays = 90;

type IdentityOrderRow = {
  id: string;
  internal_code: string;
  group_code: string | null;
  store_id: string;
  customer_rut: string | null;
  customer_email: string | null;
  customer_phone: string | null;
};

type SafeOrderRow = {
  id: string;
  internal_code: string;
  group_code: string | null;
  store_id: string;
  client_name: string;
  document_type: string;
  product_name: string;
  color: string | null;
  quantity: number | null;
  status: OrderStatus;
  entry_date: string;
  delivery_date: string;
  stores: { code: string } | null;
  production_steps: Array<{
    step: string;
    step_label: string;
    status: StepStatus;
    sort_order: number;
  }> | null;
};

const identityOrderSelect = "id, internal_code, group_code, store_id, customer_rut, customer_email, customer_phone";

export async function createClientPortalAccess({
  orderId,
  profileId,
  actorName,
  lifetimeDays = defaultLinkLifetimeDays,
}: {
  orderId: string;
  profileId?: string;
  actorName: string;
  lifetimeDays?: number;
}) {
  if (!Number.isInteger(lifetimeDays) || lifetimeDays < 1 || lifetimeDays > 365) {
    throw new Error("La vigencia del enlace no es válida.");
  }
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + lifetimeDays * 24 * 60 * 60 * 1000).toISOString();

  if (!hasSupabaseConfig()) {
    const order = await getLocalOrder(orderId);
    if (!order) throw new Error("La orden no existe.");
    const clientKey = clientPortalKeyForOrder(order);
    const link: ClientPortalLink = {
      id: randomUUID(),
      orderId,
      clientKey,
      tokenHash: hashToken(token),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt,
      createdBy: profileId,
    };
    await createLocalClientPortalLink(link, actorName);
    return { token, expiresAt, scope: hasSharedClientIdentity(clientKey) ? "customer" as const : "order" as const };
  }

  const supabase = await createClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(identityOrderSelect)
    .eq("id", orderId)
    .maybeSingle();
  if (orderError || !order) throw new Error(orderError?.message ?? "La orden no existe.");

  const clientKey = keyForRow(order as IdentityOrderRow);
  const link: ClientPortalLink = {
    id: randomUUID(),
    orderId,
    clientKey,
    tokenHash: hashToken(token),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt,
    createdBy: profileId,
  };

  const { error: revokeError } = await supabase
    .from("client_portal_links")
    .update({ revoked_at: link.createdAt, updated_at: link.updatedAt })
    .eq("client_key", clientKey)
    .is("revoked_at", null);
  if (revokeError) throw new Error(revokeError.message);
  const { error: anchorRevokeError } = await supabase
    .from("client_portal_links")
    .update({ revoked_at: link.createdAt, updated_at: link.updatedAt })
    .eq("order_id", orderId)
    .is("revoked_at", null);
  if (anchorRevokeError) throw new Error(anchorRevokeError.message);

  const { error } = await supabase.from("client_portal_links").insert({
    id: link.id,
    order_id: orderId,
    client_key: clientKey,
    token_hash: link.tokenHash,
    created_by: profileId ?? null,
    created_at: link.createdAt,
    updated_at: link.updatedAt,
    expires_at: link.expiresAt,
  });
  if (error) throw new Error(error.message);

  return { token, expiresAt, scope: hasSharedClientIdentity(clientKey) ? "customer" as const : "order" as const };
}

export async function updateClientPortalAccess({
  linkId,
  lifetimeDays,
  actorName,
}: {
  linkId: string;
  lifetimeDays: number;
  actorName: string;
}) {
  if (!Number.isInteger(lifetimeDays) || lifetimeDays < 1 || lifetimeDays > 365) {
    throw new Error("La vigencia del enlace no es válida.");
  }
  const updatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + lifetimeDays * 24 * 60 * 60 * 1000).toISOString();

  if (!hasSupabaseConfig()) {
    const orderId = await updateLocalClientPortalLink(linkId, expiresAt, actorName);
    if (!orderId) throw new Error("El enlace ya no está disponible.");
    return { orderId, expiresAt };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_portal_links")
    .update({ expires_at: expiresAt, updated_at: updatedAt })
    .eq("id", linkId)
    .is("revoked_at", null)
    .select("order_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("El enlace ya no está disponible.");

  return { orderId: data.order_id, expiresAt };
}

export async function revokeClientPortalAccessById({
  linkId,
  actorName,
}: {
  linkId: string;
  actorName: string;
}) {
  if (!hasSupabaseConfig()) {
    const orderId = await revokeLocalClientPortalLinkById(linkId, actorName);
    if (!orderId) throw new Error("El enlace ya no está disponible.");
    return orderId;
  }
  const supabase = await createClient();
  const revokedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("client_portal_links")
    .update({ revoked_at: revokedAt, updated_at: revokedAt })
    .eq("id", linkId)
    .is("revoked_at", null)
    .select("order_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("El enlace ya no está disponible.");

  return data.order_id;
}

export async function getClientPortalOrder(token: string): Promise<ClientPortalOrder | undefined> {
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(token)) return undefined;
  const tokenHash = hashToken(token);

  if (!hasSupabaseConfig()) {
    const link = await findLocalClientPortalLinkByTokenHash(tokenHash);
    if (!link) return undefined;
    const root = await getLocalOrder(link.orderId);
    if (!root) return undefined;
    const clientKey = link.clientKey || clientPortalKeyForOrder(root);
    const orders = (await listLocalOrders()).filter(
      (order) => order.documentType !== "quote" && clientPortalKeyForOrder(order) === clientKey,
    );
    return orders.length ? mapLocalPortal(root, orders) : undefined;
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_client_portal_orders", { p_token_hash: tokenHash });
  if (error || !data?.length) return undefined;

  const rows: SafeOrderRow[] = data.map((row) => ({
    id: row.order_id,
    internal_code: row.internal_code,
    group_code: row.group_code,
    store_id: row.store_id,
    client_name: row.client_name,
    document_type: row.document_type,
    product_name: row.product_name,
    color: row.color,
    quantity: row.quantity,
    status: row.status as OrderStatus,
    entry_date: row.entry_date,
    delivery_date: row.delivery_date ?? row.entry_date,
    stores: { code: row.store_code },
    production_steps: Array.isArray(row.production_steps)
      ? row.production_steps as SafeOrderRow["production_steps"]
      : [],
  }));
  return mapSafeRows(rows, data[0].link_order_id);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function keyForRow(row: IdentityOrderRow) {
  return clientPortalKey({
    store: row.store_id,
    code: row.internal_code,
    groupCode: row.group_code,
    customerRut: row.customer_rut,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
  });
}

function mapLocalPortal(root: Order, orders: Order[]): ClientPortalOrder {
  const groups = groupByDocument(orders, (order) => `${order.store}:${order.groupCode || order.code}`);
  return {
    client: root.client,
    orders: groups.map((group) => mapLocalGroup(group)),
  };
}

function mapLocalGroup(orders: Order[]): ClientPortalOrder["orders"][number] {
  const first = orders[0];
  const items = orders.map((order) => ({
    id: order.id,
    code: order.code,
    product: order.product,
    color: order.color,
    quantity: order.quantity ?? 1,
    status: order.status,
    progress: completionPercent(order),
    steps: order.steps.map(({ key, label, status }) => ({ key, label, status })),
  }));
  return {
    code: first.groupCode || first.code,
    store: first.store,
    entryDate: earliestDate(orders.map((order) => order.entryDate)),
    deliveryDate: latestDate(orders.map((order) => order.deliveryDate)),
    status: groupStatus(orders),
    progress: groupProgress(items.map((item) => item.progress)),
    items,
  };
}

function mapSafeRows(rows: SafeOrderRow[], rootOrderId: string): ClientPortalOrder {
  const root = rows.find((row) => row.id === rootOrderId) ?? rows[0];
  const groups = groupByDocument(rows, (row) => `${row.store_id}:${row.group_code || row.internal_code}`);
  return {
    client: root.client_name,
    orders: groups.map((group) => mapSafeGroup(group)),
  };
}

function mapSafeGroup(rows: SafeOrderRow[]): ClientPortalOrder["orders"][number] {
  const first = rows[0];
  const items = rows.map((row) => {
    const steps = [...(row.production_steps ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(({ step, step_label, status }) => ({ key: step, label: step_label, status }));
    const progress = steps.length
      ? Math.round((steps.filter((step) => step.status === "done").length / steps.length) * 100)
      : 0;
    return {
      id: row.id,
      code: row.internal_code,
      product: row.product_name,
      color: row.color ?? "Sin color informado",
      quantity: row.quantity ?? 1,
      status: row.status,
      progress,
      steps,
    };
  });
  return {
    code: first.group_code || first.internal_code,
    store: (first.stores?.code ?? "LR") as StoreCode,
    entryDate: earliestDate(rows.map((row) => row.entry_date)),
    deliveryDate: latestDate(rows.map((row) => row.delivery_date)),
    status: groupStatus(rows),
    progress: groupProgress(items.map((item) => item.progress)),
    items,
  };
}

function groupByDocument<T>(items: T[], keyForItem: (item: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyForItem(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return [...grouped.values()].sort((a, b) => newestEntryDate(b).localeCompare(newestEntryDate(a)));
}

function newestEntryDate<T>(group: T[]) {
  return group.reduce((latest, item) => {
    const value = item as T & { entryDate?: string; entry_date?: string };
    const entryDate = value.entryDate ?? value.entry_date ?? "";
    return entryDate > latest ? entryDate : latest;
  }, "");
}

function groupStatus(orders: Array<Pick<Order, "status">>) {
  if (orders.every((order) => order.status === "completed")) return "completed";
  if (orders.every((order) => order.status === "cancelled")) return "cancelled";
  if (orders.some((order) => order.status === "blocked")) return "blocked";
  if (orders.some((order) => order.status === "urgent")) return "urgent";
  if (orders.some((order) => order.status === "quality_control")) return "quality_control";
  if (orders.some((order) => order.status === "in_production")) return "in_production";
  return orders[0]?.status ?? "scheduled";
}

function groupProgress(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function earliestDate(values: string[]) {
  return [...values].sort()[0];
}

function latestDate(values: string[]) {
  return [...values].sort().at(-1) ?? values[0];
}
