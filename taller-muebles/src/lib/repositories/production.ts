import "server-only";

import type {
  AuditEntry,
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
import { getLocalOrder, listLocalAuditLogs, listLocalOrderAttachments, listLocalOrderComments, listLocalOrders, listLocalStockItems, listLocalStockMovements, listLocalStructureRequests, listLocalSuppliers } from "@/lib/local-store";
import { shortOrderCode } from "@/lib/order-codes";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type StoreRow = Database["public"]["Tables"]["stores"]["Row"];
type StepRow = Database["public"]["Tables"]["production_steps"]["Row"];
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
  orders: { internal_code: string; client_name: string; product_name: string } | null;
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
    .order("delivery_date", { ascending: true });

  if (error || !data) {
    console.error("Supabase orders query failed:", error?.message);
    return [];
  }

  return (data as OrderRecord[]).map(mapOrderRecord);
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
    console.error("Supabase order query failed:", error?.message);
    return undefined;
  }

  return mapOrderRecord(data as OrderRecord);
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
  if (!hasSupabaseConfig()) return listLocalOrderComments(orderId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_comments")
    .select("id, order_id, body, created_at, profiles(full_name)")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  return (data as unknown as Array<{
    id: string;
    order_id: string;
    body: string;
    created_at: string;
    profiles: { full_name: string } | null;
  }>).map((comment) => ({
    id: comment.id,
    orderId: comment.order_id,
    author: comment.profiles?.full_name ?? "Usuario",
    body: comment.body,
    createdAt: comment.created_at,
  }));
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
  if (!hasSupabaseConfig()) return listLocalStructureRequests();

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
      orders (
        internal_code,
        client_name,
        product_name
      )
    `)
    .order("requested_at", { ascending: false });
  if (error || !data) {
    console.error("Supabase structure requests query failed:", error?.message);
    return [];
  }

  const attachmentsByOrder = await Promise.all(
    Array.from(new Set(data.map((request) => request.order_id))).map(async (orderId) => [
      orderId,
      await listOrderAttachments(orderId),
    ] as const),
  );
  const attachmentMap = new Map(attachmentsByOrder);

  return data.map((request) => ({
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
    attachments: attachmentMap.get(request.order_id) ?? [],
  }));
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
