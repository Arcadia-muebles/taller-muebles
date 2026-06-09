import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppUser, AreaKey, AuditEntry, Order, OrderAttachment, OrderComment, ProductionStep, StepStatus, StockItem, StockMovement, SystemSettings } from "@/lib/types";
import { defaultSystemSettings } from "@/lib/system-settings";

type LocalData = {
  orders: Order[];
  stockItems: StockItem[];
  stockMovements: StockMovement[];
  auditLogs: AuditEntry[];
  comments: OrderComment[];
  attachments: Array<Omit<OrderAttachment, "url"> & { storagePath: string }>;
  users: AppUser[];
  settings?: SystemSettings;
};

const dataDir = path.join(process.cwd(), ".local-data");
const dataFile = path.join(dataDir, "production.json");

const emptyData: LocalData = {
  orders: [],
  stockItems: [],
  stockMovements: [],
  auditLogs: [],
  comments: [],
  attachments: [],
  users: [],
};

const defaultLocalUsers: AppUser[] = [
  {
    id: "local-admin-rodrigo",
    email: "admin@taller.local",
    name: "Rodrigo",
    role: "admin",
    active: true,
  },
  {
    id: "local-worker-structure",
    email: "estructura@taller.local",
    name: "Gustavo Rojas",
    role: "operator",
    area: "structure",
    active: true,
  },
  {
    id: "local-worker-cutting",
    email: "corte@taller.local",
    name: "Carolina Soto",
    role: "operator",
    area: "cutting",
    active: true,
  },
  {
    id: "local-worker-sewing",
    email: "costura@taller.local",
    name: "Marcela Diaz",
    role: "operator",
    area: "sewing",
    active: true,
  },
  {
    id: "local-worker-upholstery",
    email: "tapiceria@taller.local",
    name: "Pedro Morales",
    role: "operator",
    area: "upholstery",
    active: true,
  },
  {
    id: "local-worker-quality",
    email: "calidad@taller.local",
    name: "Valentina Ruiz",
    role: "operator",
    area: "quality",
    active: true,
  },
  {
    id: "local-worker-taller",
    email: "taller@taller.local",
    name: "Equipo Taller",
    role: "operator",
    active: true,
  },
];

const stepDefinitions: Array<{ key: AreaKey; label: string; ownerFallback: string }> = [
  { key: "structure", label: "Estructura", ownerFallback: "Estructura" },
  { key: "cutting", label: "Corte", ownerFallback: "Corte" },
  { key: "sewing", label: "Costura", ownerFallback: "Costura" },
  { key: "upholstery", label: "Tapiceria", ownerFallback: "Tapiceria" },
  { key: "quality", label: "Revision", ownerFallback: "Revision" },
];

async function ensureDataFile() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeFile(dataFile, JSON.stringify(emptyData, null, 2), "utf8");
  }
}

async function readData(): Promise<LocalData> {
  await ensureDataFile();
  const raw = await readFile(dataFile, "utf8");
  const parsed = JSON.parse(raw) as Partial<LocalData>;

  const data = {
    orders: parsed.orders ?? [],
    stockItems: parsed.stockItems ?? [],
    stockMovements: parsed.stockMovements ?? [],
    auditLogs: parsed.auditLogs ?? [],
    comments: parsed.comments ?? [],
    attachments: parsed.attachments ?? [],
    users: parsed.users ?? [],
    settings: parsed.settings,
  };
  const normalized = normalizeLocalData(data);
  if (normalized.changed) await writeData(normalized.data);
  return normalized.data;
}

async function writeData(data: LocalData) {
  await ensureDataFile();
  await writeFile(dataFile, JSON.stringify(data, null, 2), "utf8");
}

export async function listLocalOrders() {
  return (await readData()).orders;
}

export async function getLocalOrder(id: string) {
  return (await readData()).orders.find((order) => order.id === id);
}

export async function createLocalOrder(input: {
  store: Order["store"];
  salesNoteNumber: string;
  clientName: string;
  productName: string;
  material: string;
  color: string;
  entryDate: string;
  deliveryDate: string;
  priority: Order["priority"];
  assignedTo: string;
  observations?: string;
  isWarranty: boolean;
  steps?: SystemSettings["production"]["steps"];
}) {
  const data = await readData();
  const id = crypto.randomUUID();
  const enabledSteps = (input.steps?.length ? input.steps : stepDefinitions.map((step) => ({
    key: step.key,
    label: step.label,
    targetDays: 0,
    enabled: true,
    required: true,
  }))).filter((step) => step.enabled);
  const steps: ProductionStep[] = enabledSteps.map((step, index) => ({
    key: step.key,
    label: step.label,
    owner: index === 0 ? input.assignedTo : pickLocalStepOwner(data, step.key, step.label),
    status: index === 0 ? "active" : "pending",
    startedAt: index === 0 ? today() : undefined,
  }));

  const order: Order = {
    id,
    code: input.salesNoteNumber,
    store: input.store,
    client: input.clientName,
    product: input.productName,
    material: input.material,
    color: input.color,
    status: "in_production",
    condition: "Sin condicion",
    priority: input.priority,
    isWarranty: input.isWarranty,
    entryDate: input.entryDate,
    deliveryDate: input.deliveryDate,
    assignedTo: input.assignedTo,
    observations: input.observations?.trim() || "Sin observaciones.",
    steps,
  };

  data.orders.unshift(order);
  addAudit(data, order.id, "create_order", `Orden ${order.code} creada`);
  await writeData(data);
  return order;
}

export async function updateLocalOrder(id: string, input: {
  store: Order["store"];
  salesNoteNumber: string;
  clientName: string;
  productName: string;
  material: string;
  color: string;
  entryDate: string;
  deliveryDate: string;
  priority: Order["priority"];
  assignedTo: string;
  observations?: string;
  isWarranty: boolean;
}) {
  const data = await readData();
  const order = data.orders.find((item) => item.id === id);
  if (!order) return false;

  order.store = input.store;
  order.code = input.salesNoteNumber;
  order.client = input.clientName;
  order.product = input.productName;
  order.material = input.material;
  order.color = input.color;
  order.entryDate = input.entryDate;
  order.deliveryDate = input.deliveryDate;
  order.priority = input.priority;
  order.assignedTo = input.assignedTo;
  order.observations = input.observations?.trim() || "Sin observaciones.";
  order.isWarranty = input.isWarranty;
  addAudit(data, order.id, "update_order", "Datos comerciales y planificación actualizados");
  await writeData(data);
  return true;
}

export async function cancelLocalOrder(id: string) {
  const data = await readData();
  const order = data.orders.find((item) => item.id === id);
  if (!order) return false;
  order.status = "cancelled";
  order.condition = "Sin condicion";
  addAudit(data, order.id, "cancel_order", "Orden cancelada y enviada al historial");
  await writeData(data);
  return true;
}

export async function closeLocalOrder(id: string) {
  const data = await readData();
  const order = data.orders.find((item) => item.id === id);
  if (!order) return;

  order.status = "completed";
  order.condition = "Entregado";
  order.steps = order.steps.map((step) => ({
    ...step,
    status: "done",
    completedAt: step.completedAt ?? today(),
  }));
  addAudit(data, order.id, "close_order", "Orden cerrada y etapas marcadas como terminadas");
  await writeData(data);
}

export async function updateLocalProductionStep(input: {
  orderId: string;
  stepKey: AreaKey;
  status: StepStatus;
  reason?: string;
  autoCompleteAfterQuality?: boolean;
}) {
  const data = await readData();
  const order = data.orders.find((item) => item.id === input.orderId);
  const step = order?.steps.find((item) => item.key === input.stepKey);
  if (!order || !step) return false;

  step.status = input.status;
  step.notes = input.status === "blocked" ? input.reason : undefined;
  if (input.status === "active") step.startedAt = today();
  if (input.status === "done") step.completedAt = today();

  if (order.steps.some((item) => item.status === "blocked")) {
    order.status = "blocked";
  } else if (order.steps.every((item) => item.status === "done")) {
    order.status = input.autoCompleteAfterQuality ? "completed" : "quality_control";
    if (input.autoCompleteAfterQuality) order.condition = "Entregado";
  } else {
    order.status = order.priority === "critical" ? "urgent" : "in_production";
  }

  addAudit(data, order.id, "update_step", `${step.label}: ${input.status}${input.reason ? ` · ${input.reason}` : ""}`);
  await writeData(data);
  return true;
}

export async function listLocalStockItems() {
  return (await readData()).stockItems.filter((item) => item.active !== false);
}

export async function createLocalStockItem(input: Omit<StockItem, "id">) {
  const data = await readData();
  data.stockItems.unshift({ ...input, id: crypto.randomUUID(), active: true });
  await writeData(data);
}

export async function deactivateLocalStockItem(id: string) {
  const data = await readData();
  const item = data.stockItems.find((stockItem) => stockItem.id === id);
  if (!item) return false;
  item.active = false;
  await writeData(data);
  return true;
}

export async function listLocalStockMovements() {
  return (await readData()).stockMovements;
}

export async function listLocalAuditLogs(orderId: string) {
  return (await readData()).auditLogs.filter((entry) => entry.orderId === orderId);
}

export async function listLocalOrderComments(orderId: string) {
  return (await readData()).comments.filter((comment) => comment.orderId === orderId);
}

export async function createLocalOrderComment(orderId: string, author: string, body: string) {
  const data = await readData();
  data.comments.unshift({
    id: crypto.randomUUID(),
    orderId,
    author,
    body,
    createdAt: new Date().toISOString(),
  });
  addAudit(data, orderId, "add_comment", `${author} agregó un comentario`);
  await writeData(data);
}

export async function listLocalOrderAttachments(orderId: string): Promise<OrderAttachment[]> {
  return (await readData()).attachments
    .filter((attachment) => attachment.orderId === orderId)
    .map((attachment) => ({
      id: attachment.id,
      orderId: attachment.orderId,
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      fileSize: attachment.fileSize,
      createdAt: attachment.createdAt,
      url: `/api/local-attachments/${attachment.id}`,
    }));
}

export async function getLocalOrderAttachment(id: string) {
  return (await readData()).attachments.find((attachment) => attachment.id === id);
}

export async function createLocalOrderAttachment(orderId: string, file: File) {
  const data = await readData();
  const id = crypto.randomUUID();
  const uploadDir = path.join(dataDir, "uploads");
  await mkdir(uploadDir, { recursive: true });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = path.join(uploadDir, `${id}-${safeName}`);
  await writeFile(storagePath, Buffer.from(await file.arrayBuffer()));
  data.attachments.unshift({
    id,
    orderId,
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    fileSize: file.size,
    storagePath,
    createdAt: new Date().toISOString(),
  });
  addAudit(data, orderId, "add_attachment", `Adjunto agregado: ${file.name}`);
  await writeData(data);
}

export async function createLocalStockMovement(input: {
  materialId: string;
  type: StockMovement["type"];
  quantity: number;
  notes: string;
}) {
  const data = await readData();
  const item = data.stockItems.find((stockItem) => stockItem.id === input.materialId);
  if (!item) return false;

  const nextQuantity =
    input.type === "in"
      ? item.available + input.quantity
      : input.type === "out"
        ? item.available - input.quantity
        : input.quantity;
  if (nextQuantity < 0) return false;

  item.available = nextQuantity;
  data.stockMovements.unshift({
    id: crypto.randomUUID(),
    materialId: item.id,
    materialName: item.name,
    type: input.type,
    quantity: input.quantity,
    notes: input.notes,
    createdAt: new Date().toISOString(),
  });
  await writeData(data);
  return true;
}

export async function listLocalUsers() {
  return (await readData()).users;
}

export async function getLocalUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return (await readData()).users.find((user) => user.email.toLowerCase() === normalizedEmail);
}

export async function upsertLocalUser(user: Omit<AppUser, "id" | "active">) {
  const data = await readData();
  const existing = data.users.find((item) => item.email === user.email);

  if (existing) {
    existing.name = user.name;
    existing.role = user.role;
    existing.area = user.area;
    existing.active = true;
  } else {
    data.users.unshift({ ...user, id: crypto.randomUUID(), active: true });
  }

  await writeData(data);
}

export async function deactivateLocalUser(id: string) {
  const data = await readData();
  const user = data.users.find((item) => item.id === id);
  if (!user) return false;
  user.active = false;
  await writeData(data);
  return true;
}

export async function getLocalSystemSettings() {
  return (await readData()).settings ?? defaultSystemSettings;
}

export async function saveLocalSystemSettings(settings: SystemSettings) {
  const data = await readData();
  data.settings = settings;
  await writeData(data);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addAudit(data: LocalData, orderId: string, action: string, summary: string) {
  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    orderId,
    action,
    summary,
    createdAt: new Date().toISOString(),
  });
}

function normalizeLocalData(data: LocalData): { data: LocalData; changed: boolean } {
  let changed = false;
  const usersByEmail = new Set(data.users.map((user) => user.email.toLowerCase()));
  for (const user of defaultLocalUsers) {
    if (!usersByEmail.has(user.email.toLowerCase())) {
      data.users.push(user);
      changed = true;
    }
  }

  for (const order of data.orders) {
    for (const step of order.steps) {
      if (step.owner === step.label || step.owner === stepDefinitions.find((item) => item.key === step.key)?.ownerFallback) {
        const nextOwner = pickLocalStepOwner(data, step.key, step.owner);
        if (nextOwner !== step.owner) {
          step.owner = nextOwner;
          changed = true;
        }
      }
    }
  }

  return { data, changed };
}

function pickLocalStepOwner(data: LocalData, area: AreaKey, fallback: string) {
  return (
    data.users.find((user) => user.active && user.role === "operator" && user.area === area)?.name ??
    data.users.find((user) => user.active && user.role === "operator" && !user.area)?.name ??
    fallback
  );
}
