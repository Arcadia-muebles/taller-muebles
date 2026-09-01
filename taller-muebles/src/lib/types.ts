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

export type AgendaItemKind = "delivery" | "task";

export type AgendaItemStatus = "pending" | "done" | "cancelled";

export type AgendaTimeSlot = "AM" | "PM";

export type AgendaPriority = "low" | "normal" | "high" | "critical";

export type AgendaItem = {
  id: string;
  kind: AgendaItemKind;
  orderId?: string;
  title: string;
  notes?: string;
  scheduledDate: string;
  timeSlot: AgendaTimeSlot;
  priority: AgendaPriority;
  startTime: string;
  endTime: string;
  status: AgendaItemStatus;
  createdAt: string;
  updatedAt?: string;
};

export type StructureRequestStatus =
  | "draft"
  | "requested"
  | "in_progress"
  | "done"
  | "cancelled";

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

export type ClientPortalLink = {
  id: string;
  orderId: string;
  clientKey: string;
  tokenHash: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  createdBy?: string;
  revokedAt?: string;
};

export type ClientPortalOrder = {
  client: string;
  orders: Array<{
    code: string;
    store: StoreCode;
    entryDate: string;
    deliveryDate: string;
    status: OrderStatus;
    progress: number;
    items: Array<{
      id: string;
      code: string;
      product: string;
      color: string;
      quantity: number;
      status: OrderStatus;
      progress: number;
      steps: Array<Pick<ProductionStep, "key" | "label" | "status">>;
    }>;
  }>;
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
  customerAddress?: string;
  customerCommune?: string;
  customerRut?: string;
  customerEmail?: string;
  customerPhone?: string;
  product: string;
  productPosition?: number;
  material: string;
  color: string;
  quantity?: number;
  unitPrice?: number;
  subtotal?: number;
  discount?: number;
  total?: number;
  includesVat: boolean;
  paidAmount?: number;
  balance?: number;
  sellerName?: string;
  paymentMethod?: string;
  payments?: OrderPayment[];
  deliveryTerms?: string;
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

export type ReportOrder = Pick<
  Order,
  "id" | "code" | "documentType" | "client" | "product" | "steps"
>;

export type ReportUser = Pick<AppUser, "name" | "role" | "area" | "areas" | "active">;

export type OrderPayment = {
  id: string;
  paidAt: string;
  amount: number;
  method: string;
  note?: string;
};

export type StructureRequest = {
  id: string;
  orderId: string;
  orderCode: string;
  client: string;
  product: string;
  specifications: string;
  status: StructureRequestStatus;
  assignedTo?: string;
  requestedAt: string;
  completedAt?: string;
  updatedAt?: string;
  attachments: OrderAttachment[];
};

export type Supplier = {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  products: string;
  observations?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
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
  authorContext?: string;
  body: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
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
