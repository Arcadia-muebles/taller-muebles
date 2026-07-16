import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { ClientPortalLink, ClientPortalOrder, Order, OrderStatus, StepStatus } from "@/lib/types";
import { completionPercent } from "@/lib/metrics";
import {
  createLocalClientPortalLink,
  findLocalClientPortalLinkByTokenHash,
  getLocalClientPortalLink,
  getLocalOrder,
  listLocalOrders,
  revokeLocalClientPortalLink,
} from "@/lib/local-store";
import { hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const linkLifetimeDays = 90;

export type ClientPortalLinkSummary = Pick<ClientPortalLink, "id" | "createdAt" | "expiresAt">;

type SafeOrderRow = {
  id: string;
  internal_code: string;
  group_code: string | null;
  store_id: string;
  client_name: string;
  product_name: string;
  color: string | null;
  quantity: number | null;
  status: OrderStatus;
  entry_date: string;
  delivery_date: string;
  production_steps: Array<{
    step: string;
    step_label: string;
    status: StepStatus;
    sort_order: number;
  }> | null;
};

export async function getClientPortalLinkSummary(orderId: string): Promise<ClientPortalLinkSummary | undefined> {
  if (!hasSupabaseConfig()) {
    const link = await getLocalClientPortalLink(orderId);
    return link ? summarizeLink(link) : undefined;
  }
  if (!hasSupabaseAdminConfig()) return undefined;

  const { data, error } = await getSupabaseAdmin()
    .from("client_portal_links")
    .select("id, created_at, expires_at")
    .eq("order_id", orderId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data) return undefined;
  return { id: data.id, createdAt: data.created_at, expiresAt: data.expires_at };
}

export async function createClientPortalAccess({
  orderId,
  profileId,
  actorName,
}: {
  orderId: string;
  profileId?: string;
  actorName: string;
}) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + linkLifetimeDays * 24 * 60 * 60 * 1000).toISOString();
  const link: ClientPortalLink = {
    id: randomUUID(),
    orderId,
    tokenHash: hashToken(token),
    createdAt: now.toISOString(),
    expiresAt,
    createdBy: profileId,
  };

  if (!hasSupabaseConfig()) {
    await createLocalClientPortalLink(link, actorName);
  } else {
    if (!hasSupabaseAdminConfig()) throw new Error("Falta configurar SUPABASE_SERVICE_ROLE_KEY.");
    const admin = getSupabaseAdmin();
    await admin
      .from("client_portal_links")
      .update({ revoked_at: link.createdAt })
      .eq("order_id", orderId)
      .is("revoked_at", null);
    const { error } = await admin.from("client_portal_links").insert({
      id: link.id,
      order_id: orderId,
      token_hash: link.tokenHash,
      created_by: profileId ?? null,
      created_at: link.createdAt,
      expires_at: link.expiresAt,
    });
    if (error) throw new Error(error.message);
    await admin.from("audit_logs").insert({
      order_id: orderId,
      profile_id: profileId ?? null,
      entity: "client_portal_link",
      entity_id: link.id,
      action: "create_client_portal_link",
      new_value: expiresAt,
    });
  }

  return { token, expiresAt };
}

export async function revokeClientPortalAccess({
  orderId,
  profileId,
  actorName,
}: {
  orderId: string;
  profileId?: string;
  actorName: string;
}) {
  if (!hasSupabaseConfig()) {
    await revokeLocalClientPortalLink(orderId, actorName);
    return;
  }
  if (!hasSupabaseAdminConfig()) throw new Error("Falta configurar SUPABASE_SERVICE_ROLE_KEY.");
  const admin = getSupabaseAdmin();
  const revokedAt = new Date().toISOString();
  const { error } = await admin
    .from("client_portal_links")
    .update({ revoked_at: revokedAt })
    .eq("order_id", orderId)
    .is("revoked_at", null);
  if (error) throw new Error(error.message);
  await admin.from("audit_logs").insert({
    order_id: orderId,
    profile_id: profileId ?? null,
    entity: "client_portal_link",
    action: "revoke_client_portal_link",
    new_value: revokedAt,
  });
}

export async function getClientPortalOrder(token: string): Promise<ClientPortalOrder | undefined> {
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(token)) return undefined;
  const tokenHash = hashToken(token);

  if (!hasSupabaseConfig()) {
    const link = await findLocalClientPortalLinkByTokenHash(tokenHash);
    if (!link) return undefined;
    const root = await getLocalOrder(link.orderId);
    if (!root) return undefined;
    const orders = (await listLocalOrders()).filter(
      (order) => order.store === root.store && order.groupCode === root.groupCode,
    );
    return mapPortalOrder(root, orders);
  }

  if (!hasSupabaseAdminConfig()) return undefined;
  const admin = getSupabaseAdmin();
  const { data: link, error: linkError } = await admin
    .from("client_portal_links")
    .select("order_id")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (linkError || !link) return undefined;

  const { data: root, error: rootError } = await admin
    .from("orders")
    .select("id, group_code, store_id")
    .eq("id", link.order_id)
    .maybeSingle();
  if (rootError || !root) return undefined;

  const { data, error } = await admin
    .from("orders")
    .select("id, internal_code, group_code, store_id, client_name, product_name, color, quantity, status, entry_date, delivery_date, production_steps(step, step_label, status, sort_order)")
    .eq("group_code", root.group_code)
    .eq("store_id", root.store_id)
    .order("internal_code", { ascending: true });
  if (error || !data?.length) return undefined;
  return mapSafeRows(data as SafeOrderRow[]);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function summarizeLink(link: ClientPortalLink): ClientPortalLinkSummary {
  return { id: link.id, createdAt: link.createdAt, expiresAt: link.expiresAt };
}

function mapPortalOrder(root: Order, orders: Order[]): ClientPortalOrder {
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
    code: root.groupCode || root.code,
    client: root.client,
    entryDate: root.entryDate,
    deliveryDate: root.deliveryDate,
    status: groupStatus(orders),
    progress: groupProgress(items.map((item) => item.progress)),
    items,
  };
}

function mapSafeRows(rows: SafeOrderRow[]): ClientPortalOrder {
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
  const first = rows[0];
  return {
    code: first.group_code || first.internal_code,
    client: first.client_name,
    entryDate: first.entry_date,
    deliveryDate: first.delivery_date,
    status: groupStatus(rows.map((row) => ({ status: row.status }))),
    progress: groupProgress(items.map((item) => item.progress)),
    items,
  };
}

function groupStatus(orders: Array<Pick<Order, "status">>) {
  if (orders.every((order) => order.status === "completed")) return "completed";
  if (orders.some((order) => order.status === "blocked")) return "blocked";
  if (orders.some((order) => order.status === "urgent")) return "urgent";
  if (orders.some((order) => order.status === "quality_control")) return "quality_control";
  if (orders.some((order) => order.status === "in_production")) return "in_production";
  return orders[0]?.status ?? "scheduled";
}

function groupProgress(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}
