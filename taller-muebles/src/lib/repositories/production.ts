import "server-only";

import { orders as demoOrders, stockItems as demoStockItems } from "@/lib/mock-data";
import type {
  Order,
  OrderStatus,
  ProductionStep,
  StepStatus,
  StockItem,
  StoreCode,
} from "@/lib/types";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type StoreRow = Database["public"]["Tables"]["stores"]["Row"];
type StepRow = Database["public"]["Tables"]["production_steps"]["Row"];
type MaterialRow = Database["public"]["Tables"]["materials"]["Row"];

type OrderRecord = OrderRow & {
  stores: Pick<StoreRow, "code" | "name"> | null;
  production_steps: StepRow[] | null;
};

const stepLabels: Record<StepRow["step"], string> = {
  structure: "Estructura",
  cutting: "Corte",
  sewing: "Costura",
  upholstery: "Tapiceria",
  quality: "Revision",
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
    return demoOrders;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      stores:store_id (code, name),
      production_steps (*)
    `,
    )
    .order("delivery_date", { ascending: true });

  if (error || !data) {
    console.warn("Falling back to demo orders:", error?.message);
    return demoOrders;
  }

  return (data as OrderRecord[]).map(mapOrderRecord);
}

export async function getOrder(id: string): Promise<Order | undefined> {
  if (!hasSupabaseConfig()) {
    return demoOrders.find((order) => order.id === id);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      stores:store_id (code, name),
      production_steps (*)
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    console.warn("Falling back to demo order:", error?.message);
    return demoOrders.find((order) => order.id === id);
  }

  return mapOrderRecord(data as OrderRecord);
}

export async function listStockItems(): Promise<StockItem[]> {
  if (!hasSupabaseConfig()) {
    return demoStockItems;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materials")
    .select("*")
    .eq("active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data) {
    console.warn("Falling back to demo stock:", error?.message);
    return demoStockItems;
  }

  return (data as MaterialRow[]).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit,
    available: Number(item.current_quantity),
    minimum: Number(item.minimum_quantity),
    store: "general",
  }));
}

function mapOrderRecord(record: OrderRecord): Order {
  const steps = (record.production_steps ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(mapStepRecord);

  return {
    id: record.id,
    code: record.internal_code,
    store: (record.stores?.code ?? "LH") as StoreCode,
    client: record.client_name,
    product: record.product_name,
    material: record.material ?? "Sin material",
    color: record.color ?? "Sin color",
    status: record.status as OrderStatus,
    condition: conditionLabels[record.condition] ?? "Sin condicion",
    priority: record.priority as Order["priority"],
    isWarranty: record.is_warranty,
    entryDate: record.entry_date,
    deliveryDate: record.delivery_date ?? record.entry_date,
    assignedTo: record.assigned_to ?? "Sin asignar",
    observations: record.observations ?? "Sin observaciones.",
    steps,
  };
}

function mapStepRecord(record: StepRow): ProductionStep {
  return {
    key: record.step,
    label: stepLabels[record.step],
    owner: record.assigned_to ?? "Sin asignar",
    status: record.status as StepStatus,
    startedAt: record.started_at?.slice(0, 10),
    completedAt: record.completed_at?.slice(0, 10),
  };
}
