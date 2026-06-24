export type StoreCode = "LH" | "LR";

export type CommercialDocumentType =
  | "sales_note"
  | "quote"
  | "purchase_order"
  | "warranty"
  | "production_intake";

export type CommercialDocumentStatus =
  | "draft"
  | "issued"
  | "approved"
  | "closed"
  | "cancelled";

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

export type AreaKey = string;

export type ProductionStep = {
  key: AreaKey;
  label: string;
  owner: string;
  status: StepStatus;
  notes?: string;
  startedAt?: string;
  completedAt?: string;
};

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  area?: AreaKey;
  areas?: AreaKey[];
  active: boolean;
};

export type Order = {
  id: string;
  code: string;
  groupCode: string;
  store: StoreCode;
  documentType: CommercialDocumentType;
  documentStatus: CommercialDocumentStatus;
  client: string;
  customerContact?: string;
  product: string;
  material: string;
  color: string;
  quantity?: number;
  unitPrice?: number;
  subtotal?: number;
  discount?: number;
  total?: number;
  paidAmount?: number;
  balance?: number;
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
  completedAt?: string;
  assignedTo: string;
  observations: string;
  steps: ProductionStep[];
};

export type StockLocation = "warehouse" | "workshop";

export type StockItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  available: number;
  minimum: number;
  store: StoreCode | "general";
  location: StockLocation;
  active?: boolean;
};

export type StockMovement = {
  id: string;
  materialId: string;
  materialName: string;
  type: "in" | "out" | "adjustment";
  quantity: number;
  notes: string;
  createdAt: string;
};

export type AuditEntry = {
  id: string;
  orderId: string;
  action: string;
  summary: string;
  createdAt: string;
};

export type OrderComment = {
  id: string;
  orderId: string;
  author: string;
  body: string;
  createdAt: string;
};

export type OrderAttachment = {
  id: string;
  orderId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  createdAt: string;
};

export type SystemSettings = {
  general: {
    businessName: string;
    timezone: string;
    workdayStart: string;
    workdayEnd: string;
    workdays: number[];
  };
  production: {
    steps: Array<{
      key: AreaKey;
      label: string;
      targetDays: number;
      enabled: boolean;
      required: boolean;
    }>;
    allowParallelSteps: boolean;
    requireQualityApproval: boolean;
    autoCompleteAfterQuality: boolean;
  };
  orders: {
    defaultPriority: Order["priority"];
    requireAssignedPerson: boolean;
    requireMaterialAndColor: boolean;
    requireObservationsForWarranty: boolean;
    enforceUniqueSalesNote: boolean;
    allowPastDeliveryDates: boolean;
    archiveCompletedAfterDays: number;
  };
  alerts: {
    upcomingDeliveryDays: number;
    urgentDeliveryDays: number;
    blockedAfterHours: number;
    stockAlertsEnabled: boolean;
    deliveryAlertsEnabled: boolean;
    blockedAlertsEnabled: boolean;
    dailySummaryEnabled: boolean;
    dailySummaryTime: string;
  };
  permissions: {
    managersCanEditOrders: boolean;
    managersCanManageStock: boolean;
    operatorsCanStartSteps: boolean;
    operatorsCanCompleteSteps: boolean;
    operatorsCanBlockSteps: boolean;
    requireBlockReason: boolean;
  };
  updatedAt?: string;
  updatedBy?: string;
};
