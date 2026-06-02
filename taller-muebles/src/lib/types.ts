export type StoreCode = "LH" | "LR";

export type OrderStatus =
  | "draft"
  | "scheduled"
  | "in_production"
  | "blocked"
  | "urgent"
  | "quality_control"
  | "completed"
  | "cancelled";

export type StepStatus = "pending" | "active" | "done" | "blocked";

export type Role = "admin" | "manager" | "operator" | "viewer";

export type ProductionStep = {
  key: "structure" | "cutting" | "sewing" | "upholstery" | "quality";
  label: string;
  owner: string;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
};

export type Order = {
  id: string;
  code: string;
  store: StoreCode;
  client: string;
  product: string;
  material: string;
  color: string;
  status: OrderStatus;
  condition:
    | "Sin condicion"
    | "En bodega"
    | "En exhibicion"
    | "Control de calidad"
    | "Entregado";
  priority: "normal" | "high" | "critical";
  isWarranty: boolean;
  entryDate: string;
  deliveryDate: string;
  assignedTo: string;
  observations: string;
  steps: ProductionStep[];
};

export type StockItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  available: number;
  minimum: number;
  store: StoreCode | "general";
};
