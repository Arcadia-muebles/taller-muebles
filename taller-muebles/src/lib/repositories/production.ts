import "server-only";

import type {
  AuditEntry,
  AgendaItem,
  AppUser,
  Order,
  OrderAttachment,
  OrderComment,
  OrderStatus,
  ProductionStep,
  StepStatus,
  StockItem,
  StockMovement,
  StructureRequest,
  Supplier,
  StoreCode,
  CommercialDocumentStatus,
  CommercialDocumentType,
} from "@/lib/types";
import { hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/env";
import { getLocalOrder, listLocalAgendaItems, listLocalAuditLogs, listLocalOrderAttachments, listLocalOrderCommentsForOrders, listLocalOrders, listLocalStockItems, listLocalStockMovements, listLocalStructureRequests, listLocalSuppliers } from "@/lib/local-store";
import { shortOrderCode } from "@/lib/order-codes";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type StoreRow = Database["public"]["Tables"]["stores"]["Row"];
type StepRow = Database["public"]["Tables"]["production_steps"]["Row"];
type AgendaItemRow = Database["public"]["Tables"]["agenda_items"]["Row"];
type MaterialRow = Database["public"]["Tables"]["materials"]["Row"];
type LooseDb<T> = {
  from: (table: string) => LooseQuery<T>;
};
type LooseQuery<T> = {
  select: (columns?: string) => LooseQuery<T>;
  order: (column: string, options?: { ascending?: boolean }) => LooseQuery<T> & Promise<{ data: T[] | null; error: { message: string } | null }>;
  eq: (column: string, value: string) => LooseQuery<T>;
  neq: (column: string, value: string) => LooseQuery<T>;
  maybeSingle: () => Promise<{ data: T | null; error: { message: string } | null }>;
};

type StructureRequestRecord = {
  id: string;
  order_id: string;
  specifications: string;
  status: StructureRequest["status"];
  assigned_to: string | null;
  requested_at: string;
  completed_at: string | null;
  updated_at: string;
  orders: { internal_code: string; client_name: string; product_name: string } | null;
};

export type StructureRequestsSnapshot = {
  requests: StructureRequest[];
  loadError: boolean;
};

type SupplierRecord = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  products: string | null;
  observations: string | null;
  active: boolean;
  created_at: string;
  updated_at: string | null;
};

type StepRecord = StepRow & {
  assigned_profile: { full_name: string } | null;
};

type OrderRecord = OrderRow & {
  stores: Pick<StoreRow, "code" | "name"> | null;
  assigned_profile: { full_name: string } | null;
  production_steps: StepRecord[] | null;
};

type OrderPaymentRecord = { id: string; order_id: string; paid_at: string; amount: number | string; method: string; note: string | null };
type PaymentQuery = { select: (columns: string) => { in: (column: string, values: string[]) => { order: (column: string, options: { ascending: boolean }) => Promise<{ data: OrderPaymentRecord[] | null; error: { message: string } | null }> } } };

export type ProductionOrderState = Pick<Order, "id" | "documentType" | "priority" | "steps">;

type ProductionStateRecord = Pick<OrderRow, "id" | "document_type" | "priority"> & {
  production_steps: Array<Pick<StepRow, "step" | "step_label" | "status" | "notes" | "started_at" | "completed_at" | "sort_order">> | null;
};

const conditionLabels: Record<string, Order["condition"]> = {
  none: "Sin condicion",
  warehouse: "En bodega",
  showroom: "En exhibicion",
  loaned: "En exhibicion",
  quality_control: "Control de calidad",
  delivered: "Entregado",
};

export async function listOrders(): Promise<Order[]> {
  if (!hasSupabaseConfig()) {
    return listLocalOrders();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      stores:store_id (code, name),
      assigned_profile:profiles!orders_assigned_to_fkey (full_name),
      production_steps (*, assigned_profile:profiles!production_steps_assigned_to_fkey (full_name))
    `,
    )
    .order("delivery_date", { ascending: true })
    .order("internal_code", { ascending: true })
    .order("product_name", { ascending: true })
    .order("id", { ascending: true });

  if (error || !data) {
    console.error("Supabase orders query failed:", error?.message);
    return [];
  }

  const orders = (data as OrderRecord[]).map(mapOrderRecord);
  return attachOrderPayments(supabase, orders);
}

export async function getOrder(id: string): Promise<Order | undefined> {
  if (!hasSupabaseConfig()) {
    return getLocalOrder(id);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      stores:store_id (code, name),
      assigned_profile:profiles!orders_assigned_to_fkey (full_name),
      production_steps (*, assigned_profile:profiles!production_steps_assigned_to_fkey (full_name))
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("Supabase order query failed:", error.message);
    return (await listOrders()).find((order) => order.id === id);
  }

  const order = mapOrderRecord(data as OrderRecord);
  return (await attachOrderPayments(supabase, [order]))[0];
}

export async function getOrderProductionState(id: string): Promise<ProductionOrderState | undefined> {
  if (!hasSupabaseConfig()) {
    const order = await getLocalOrder(id);
    if (!order) return undefined;
    return {
      id: order.id,
      documentType: order.documentType,
      priority: order.priority,
      steps: order.steps,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      document_type,
      priority,
      production_steps (step, step_label, status, notes, started_at, completed_at, sort_order)
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    console.error("Supabase production state query failed:", error?.message);
    return undefined;
  }

  const record = data as unknown as ProductionStateRecord;
  return {
    id: record.id,
    documentType: record.document_type as CommercialDocumentType,
    priority: record.priority as Order["priority"],
    steps: (record.production_steps ?? [])
      .sort((first, second) => first.sort_order - second.sort_order)
      .map((step) => ({
        key: step.step,
        label: step.step_label,
        owner: "",
        status: step.status as StepStatus,
        notes: step.notes ?? undefined,
        startedAt: step.started_at ?? undefined,
        completedAt: step.completed_at ?? undefined,
      })),
  };
}

async function attachOrderPayments(supabase: Awaited<ReturnType<typeof createClient>>, orders: Order[]) {
  if (!orders.length) return orders;
  const paymentDb = supabase as unknown as { from: (table: string) => PaymentQuery };
  const paymentsTable = paymentDb.from("order_payments");
  const { data, error } = await paymentsTable.select("id, order_id, paid_at, amount, method, note").in("order_id", orders.map((order) => order.id)).order("paid_at", { ascending: true });
  if (error || !data) return orders;
  const paymentsByOrder = new Map<string, OrderPaymentRecord[]>();
  for (const payment of data) paymentsByOrder.set(payment.order_id, [...(paymentsByOrder.get(payment.order_id) ?? []), payment]);
  return orders.map((order) => {
    const payments = (paymentsByOrder.get(order.id) ?? []).map((payment) => ({
      id: payment.id,
      paidAt: payment.paid_at,
      amount: Number(payment.amount),
      method: payment.method,
      note: payment.note ?? undefined,
    }));
    const historyTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const correctedPayments = historyTotal > 0 && historyTotal * 1000 === order.paidAmount
      ? payments.map((payment) => ({ ...payment, amount: payment.amount * 1000 }))
      : payments;
    return { ...order, payments: correctedPayments };
  });
}

export async function listAgendaItems(date?: string): Promise<AgendaItem[]> {
  if (!hasSupabaseConfig()) {
    return listLocalAgendaItems(date);
  }

  const supabase = await createClient();
  let query = supabase
    .from("agenda_items")
    .select("*")
    .neq("status", "cancelled")
    .order("scheduled_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (date) query = query.eq("scheduled_date", date);

  const { data, error } = await query;
  if (error || !data) {
    console.error("Supabase agenda query failed:", error?.message);
    return listLocalAgendaItems(date);
  }

  return (data as AgendaItemRow[]).map(mapAgendaItemRecord);
}

export async function listStockItems(): Promise<StockItem[]> {
  if (!hasSupabaseConfig()) {
    return listLocalStockItems();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materials")
    .select("*")
    .eq("active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data) {
    console.error("Supabase stock query failed:", error?.message);
    return [];
  }

  return (data as MaterialRow[]).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit,
    available: Number(item.current_quantity),
    minimum: Number(item.minimum_quantity),
    store: "general",
    location: item.location ?? "warehouse",
  }));
}

export async function listStockMovements(): Promise<StockMovement[]> {
  if (!hasSupabaseConfig()) return listLocalStockMovements();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_movements")
    .select("id, material_id, movement_type, quantity, notes, created_at, materials(name)")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return [];

  return (data as unknown as Array<{
    id: string;
    material_id: string;
    movement_type: StockMovement["type"];
    quantity: number;
    notes: string | null;
    created_at: string;
    materials: { name: string } | null;
  }>).map((movement) => ({
    id: movement.id,
    materialId: movement.material_id,
    materialName: movement.materials?.name ?? "Material",
    type: movement.movement_type,
    quantity: Number(movement.quantity),
    notes: movement.notes ?? "Sin nota",
    createdAt: movement.created_at,
  }));
}

export async function listOrderAudit(orderId: string): Promise<AuditEntry[]> {
  if (!hasSupabaseConfig()) return listLocalAuditLogs(orderId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, order_id, action, field_name, old_value, new_value, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error || !data) return [];

  return data.map((entry) => ({
    id: entry.id,
    orderId: entry.order_id ?? orderId,
    action: entry.action,
    summary: [
      entry.field_name,
      entry.old_value && `antes: ${entry.old_value}`,
      entry.new_value && `ahora: ${entry.new_value}`,
    ].filter(Boolean).join(" · ") || entry.action,
    createdAt: entry.created_at,
  }));
}

export async function listUsers(): Promise<AppUser[]> {
  if (!hasSupabaseConfig()) {
    const { listLocalUsers } = await import("@/lib/local-store");
    return listLocalUsers();
  }

  const profileClient = hasSupabaseAdminConfig() ? getSupabaseAdmin() : await createClient();
  const { data, error } = await profileClient
    .from("profiles")
    .select("id, user_id, full_name, role, area, active")
    .order("full_name");
  if (error || !data) return [];

  const emails = new Map<string, string>();
  if (hasSupabaseAdminConfig()) {
    const { data: authUsers } = await getSupabaseAdmin().auth.admin.listUsers();
    authUsers.users.forEach((user) => emails.set(user.id, user.email ?? ""));
  }

  return data.map((profile) => ({
    id: profile.id,
    email: emails.get(profile.user_id) || profile.user_id,
    name: profile.full_name,
    role: profile.role,
    area: parseAreas(profile.area)[0],
    areas: parseAreas(profile.area),
    active: profile.active,
  }));
}

export async function listOrderComments(orderId: string): Promise<OrderComment[]> {
  const commentsByOrder = await listCommentsForOrders([orderId]);
  return commentsByOrder[orderId] ?? [];
}

export async function listCommentsForOrders(orderIds: string[]): Promise<Record<string, OrderComment[]>> {
  const uniqueOrderIds = [...new Set(orderIds.filter(Boolean))];
  if (!uniqueOrderIds.length) return {};

  if (!hasSupabaseConfig()) {
    return groupCommentsByOrder(await listLocalOrderCommentsForOrders(uniqueOrderIds));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_comments")
    .select("id, order_id, body, created_at, profiles(full_name, role, area)")
    .in("order_id", uniqueOrderIds)
    .order("created_at", { ascending: false });
  if (error || !data) return {};

  const comments = (data as unknown as Array<{
    id: string;
    order_id: string;
    body: string;
    created_at: string;
    profiles: { full_name: string; role: string; area: string | string[] | null } | null;
  }>).map((comment) => ({
    id: comment.id,
    orderId: comment.order_id,
    author: comment.profiles?.full_name ?? "Usuario",
    authorContext: profileContext(comment.profiles),
    body: comment.body,
    createdAt: comment.created_at,
  }));
  return groupCommentsByOrder(comments);
}

function groupCommentsByOrder(comments: OrderComment[]) {
  return comments.reduce<Record<string, OrderComment[]>>((grouped, comment) => {
    (grouped[comment.orderId] ??= []).push(comment);
    return grouped;
  }, {});
}

function profileContext(profile: { role: string; area: string | string[] | null } | null) {
  if (!profile) return undefined;
  if (profile.role === "admin") return "Administración";
  if (profile.role === "manager") return "Supervisión";
  const areas = Array.isArray(profile.area) ? profile.area : profile.area ? [profile.area] : [];
  return areas.length ? areas.map(areaLabel).join(", ") : "Taller";
}

function areaLabel(area: string) {
  const labels: Record<string, string> = {
    structure: "Estructura",
    en_blanco: "En Blanco",
    cutting: "Corte",
    sewing: "Costura",
    upholstery: "Tapicería",
    quality: "Calidad",
    dispatch: "Despacho",
  };
  return labels[area] ?? area;
}

export async function listOrderAttachments(orderId: string): Promise<OrderAttachment[]> {
  if (!hasSupabaseConfig()) return listLocalOrderAttachments(orderId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_attachments")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  return Promise.all(data.map(async (attachment) => {
    const { data: signed } = await supabase.storage
      .from("order-attachments")
      .createSignedUrl(attachment.storage_path, 60 * 15);
    return {
      id: attachment.id,
      orderId: attachment.order_id,
      fileName: attachment.file_name,
      fileType: attachment.file_type,
      fileSize: Number(attachment.file_size_bytes ?? 0),
      url: signed?.signedUrl ?? "#",
      createdAt: attachment.created_at,
    };
  }));
}

function mapOrderRecord(record: OrderRecord): Order {
  const steps = (record.production_steps ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(mapStepRecord);
  const code = shortOrderCode(record.internal_code);
  const groupCode = shortOrderCode(record.group_code ?? record.internal_code);

  return {
    id: record.id,
    code,
    groupCode,
    store: (record.stores?.code ?? "LH") as StoreCode,
    documentType: (record.document_type ?? ((record.stores?.code ?? "LH") === "LH" ? "production_intake" : "sales_note")) as CommercialDocumentType,
    documentStatus: (record.document_status ?? "issued") as CommercialDocumentStatus,
    client: record.client_name,
    customerContact: record.customer_contact ?? undefined,
    customerAddress: record.customer_address ?? undefined,
    customerCommune: record.customer_commune ?? undefined,
    customerRut: record.customer_rut ?? undefined,
    customerEmail: record.customer_email ?? undefined,
    customerPhone: record.customer_phone ?? undefined,
    product: record.product_name,
    material: record.material ?? "Sin material",
    color: record.color ?? "Sin color",
    quantity: record.quantity === null ? undefined : Number(record.quantity ?? 1),
    unitPrice: record.unit_price === null ? undefined : Number(record.unit_price),
    subtotal: record.subtotal_amount === null ? undefined : Number(record.subtotal_amount),
    discount: record.discount_amount === null ? undefined : Number(record.discount_amount),
    total: record.total_amount === null ? undefined : Number(record.total_amount),
    paidAmount: record.paid_amount === null ? undefined : Number(record.paid_amount),
    balance: record.balance_amount === null ? undefined : Number(record.balance_amount),
    sellerName: (record as OrderRow & { seller_name?: string | null }).seller_name ?? undefined,
    paymentMethod: (record as OrderRow & { payment_method?: string | null }).payment_method ?? undefined,
    deliveryTerms: (record as OrderRow & { delivery_terms?: string | null }).delivery_terms ?? undefined,
    status: record.status as OrderStatus,
    condition: conditionLabels[record.condition] ?? "Sin condicion",
    priority: record.priority as Order["priority"],
    isWarranty: record.is_warranty,
    entryDate: record.entry_date,
    deliveryDate: record.delivery_date ?? record.entry_date,
    completedAt: record.completed_at ?? undefined,
    assignedTo: normalizeOwner(record.assigned_profile?.full_name),
    observations: record.observations ?? "Sin observaciones.",
    steps,
  };
}

export async function listStructureRequests(): Promise<StructureRequest[]> {
  return (await getStructureRequestsSnapshot()).requests;
}

export async function getStructureRequestsSnapshot(): Promise<StructureRequestsSnapshot> {
  if (!hasSupabaseConfig()) {
    return { requests: await listLocalStructureRequests(), loadError: false };
  }

  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as LooseDb<StructureRequestRecord>)
    .from("structure_requests")
    .select(`
      id,
      order_id,
      specifications,
      status,
      assigned_to,
      requested_at,
      completed_at,
      updated_at,
      orders (
        internal_code,
        client_name,
        product_name
      )
    `)
    .order("requested_at", { ascending: false });
  if (error || !data) {
    console.error("Supabase structure requests query failed:", error?.message);
    return { requests: [], loadError: true };
  }

  const attachmentsByOrder = await Promise.all(
    Array.from(new Set(data.map((request) => request.order_id))).map(async (orderId) => [
      orderId,
      await listOrderAttachments(orderId),
    ] as const),
  );
  const attachmentMap = new Map(attachmentsByOrder);

  return {
    loadError: false,
    requests: data.map((request) => ({
    id: request.id,
    orderId: request.order_id,
    orderCode: shortOrderCode(request.orders?.internal_code ?? ""),
    client: request.orders?.client_name ?? "Sin cliente",
    product: request.orders?.product_name ?? "Sin producto",
    specifications: request.specifications,
    status: request.status,
    assignedTo: request.assigned_to ?? undefined,
    requestedAt: request.requested_at,
    completedAt: request.completed_at ?? undefined,
    updatedAt: request.updated_at,
    attachments: attachmentMap.get(request.order_id) ?? [],
    })),
  };
}

export async function listSuppliers(): Promise<Supplier[]> {
  if (!hasSupabaseConfig()) return listLocalSuppliers();

  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as LooseDb<SupplierRecord>)
    .from("suppliers")
    .select("*")
    .order("active", { ascending: false })
    .order("name", { ascending: true });
  if (error || !data) {
    console.error("Supabase suppliers query failed:", error?.message);
    return [];
  }

  return data.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    contactName: supplier.contact_name ?? undefined,
    phone: supplier.phone ?? undefined,
    email: supplier.email ?? undefined,
    address: supplier.address ?? undefined,
    products: supplier.products ?? "",
    observations: supplier.observations ?? undefined,
    active: supplier.active,
    createdAt: supplier.created_at,
    updatedAt: supplier.updated_at ?? undefined,
  }));
}

function mapStepRecord(record: StepRecord): ProductionStep {
  return {
    key: record.step,
    label: normalizeStepLabel(record.step, record.step_label || labelFromStepKey(record.step)),
    owner: normalizeOwner(record.assigned_profile?.full_name),
    status: record.status as StepStatus,
    notes: record.notes ?? record.blocked_reason ?? undefined,
    startedAt: record.started_at ?? undefined,
    completedAt: record.completed_at ?? undefined,
  };
}

function mapAgendaItemRecord(record: AgendaItemRow): AgendaItem {
  return {
    id: record.id,
    kind: record.kind,
    orderId: record.order_id ?? undefined,
    title: record.title,
    notes: record.notes ?? undefined,
    scheduledDate: record.scheduled_date,
    timeSlot: record.time_slot,
    startTime: record.start_time.slice(0, 5),
    endTime: record.end_time.slice(0, 5),
    status: record.status,
    createdAt: record.created_at,
    updatedAt: record.updated_at ?? undefined,
  };
}

function normalizeStepLabel(step: string, label: string) {
  if (step === "dispatch" || /despacho/i.test(label)) return "Terminado";
  return label;
}

function normalizeOwner(value?: string | null) {
  return value && value !== "Sin asignar" ? value : "Sin responsable asignado";
}

function labelFromStepKey(step: string) {
  return step
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Etapa";
}

function parseAreas(value?: string | null) {
  return (value ?? "")
    .split(",")
    .map((area) => area.trim())
    .filter(Boolean);
}
