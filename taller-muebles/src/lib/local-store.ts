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
    id: "local-supervisor",
    email: "supervisor@taller.local",
    name: "Supervisor Taller",
    role: "manager",
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
    id: "local-worker-en-blanco",
    email: "enblanco@taller.local",
    name: "Equipo En Blanco",
    role: "operator",
    area: "en_blanco",
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
    name: "Marcela Díaz",
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
    id: "local-worker-dispatch",
    email: "despacho@taller.local",
    name: "Equipo Despacho",
    role: "operator",
    area: "dispatch",
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
  { key: "en_blanco", label: "En Blanco", ownerFallback: "En Blanco" },
  { key: "cutting", label: "Corte", ownerFallback: "Corte" },
  { key: "sewing", label: "Costura", ownerFallback: "Costura" },
  { key: "upholstery", label: "Tapicería", ownerFallback: "Tapicería" },
  { key: "quality", label: "Control Calidad", ownerFallback: "Control Calidad" },
  { key: "dispatch", label: "Despacho", ownerFallback: "Despacho" },
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
  groupCode?: string;
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
    startedAt: index === 0 ? nowIso() : undefined,
  }));

  const order: Order = {
    id,
    code: input.salesNoteNumber,
    groupCode: input.groupCode?.trim() || input.salesNoteNumber,
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
  salesNoteNumber?: string;
  groupCode?: string;
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
  order.code = input.salesNoteNumber?.trim() || order.code;
  order.groupCode = input.groupCode?.trim() || order.code;
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
  order.completedAt = nowIso();
  order.steps = order.steps.map((step) => ({
    ...step,
    status: "done",
    completedAt: step.completedAt ?? nowIso(),
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

  const previousStatus = step.status;
  const isReversal =
    (previousStatus === "active" && input.status === "pending") ||
    (previousStatus === "done" && input.status === "active") ||
    (previousStatus === "blocked" && input.status === "pending");
  const now = nowIso();
  step.status = input.status;
  if (input.reason?.trim()) step.notes = input.reason.trim();
  if (input.status === "blocked") step.notes = input.reason;
  if (input.status === "pending") {
    step.startedAt = undefined;
    step.completedAt = undefined;
  }
  if (input.status === "active") {
    step.startedAt = step.startedAt ?? now;
    step.completedAt = undefined;
  }
  if (input.status === "done") {
    step.startedAt = step.startedAt ?? now;
    step.completedAt = now;
    const nextStep = nextPendingStep(order, step.key);
    if (nextStep) {
      nextStep.status = "pending";
    }
  }

  if (isReversal) {
    const currentIndex = order.steps.findIndex((item) => item.key === step.key);
    for (const laterStep of order.steps.slice(currentIndex + 1)) {
      laterStep.status = "pending";
      laterStep.startedAt = undefined;
      laterStep.completedAt = undefined;
    }
  }

  if (order.steps.some((item) => item.status === "blocked")) {
    order.status = "blocked";
  } else if (order.steps.every((item) => item.status === "done")) {
    const waitsForManualClose = step.key === "quality" && input.autoCompleteAfterQuality === false;
    order.status = waitsForManualClose ? "quality_control" : "completed";
    order.condition = waitsForManualClose ? "Control de calidad" : "Entregado";
  } else if (order.steps.find((item) => item.key === "quality")?.status === "active") {
    order.status = "quality_control";
    order.condition = "Control de calidad";
  } else {
    order.status = order.priority === "critical" ? "urgent" : "in_production";
    if (order.condition === "Entregado" || order.condition === "Control de calidad") {
      order.condition = "Sin condicion";
    }
  }

  addAudit(
    data,
    order.id,
    isReversal ? "revert_step" : "update_step",
    `${step.label}: ${previousStatus} -> ${input.status}${input.reason ? ` · ${input.reason}` : ""}`,
  );
  await writeData(data);
  return true;
}

export async function moveLocalOrderToStep(input: {
  orderId: string;
  stepKey: AreaKey;
  actorName: string;
}) {
  const data = await readData();
  const order = data.orders.find((item) => item.id === input.orderId);
  if (!order) return false;
  const targetIndex = order.steps.findIndex((step) => step.key === input.stepKey);
  if (targetIndex < 0) return false;

  const now = nowIso();
  order.steps = order.steps.map((step, index) => {
    if (index < targetIndex) {
      return {
        ...step,
        status: "done",
        startedAt: step.startedAt ?? step.completedAt ?? now,
        completedAt: step.completedAt ?? now,
      };
    }
    if (index === targetIndex) {
      return {
        ...step,
        status: "pending",
        startedAt: undefined,
        completedAt: undefined,
      };
    }
    return {
      ...step,
      status: "pending",
      startedAt: undefined,
      completedAt: undefined,
    };
  });

  order.status = input.stepKey === "quality"
    ? "quality_control"
    : order.priority === "critical"
      ? "urgent"
      : "in_production";
  order.condition = input.stepKey === "quality" ? "Control de calidad" : order.condition;
  if (input.stepKey !== "quality" && order.condition === "Entregado") {
    order.condition = "Sin condicion";
  }

  const target = order.steps[targetIndex];
  addAudit(data, order.id, "move_step", `${input.actorName} movio la orden a ${target.label}`);
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

export async function updateLocalProductionStepComment(
  orderId: string,
  stepKey: AreaKey,
  body: string,
  author: string,
) {
  const data = await readData();
  const order = data.orders.find((item) => item.id === orderId);
  const step = order?.steps.find((item) => item.key === stepKey);
  if (!order || !step) return false;

  step.notes = body.trim();
  addAudit(data, orderId, "comment_step", `${author} comentó la etapa ${step.label}`);
  await writeData(data);
  return true;
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
    existing.areas = user.areas ?? parseAreas(user.area);
    existing.active = true;
  } else {
    data.users.unshift({ ...user, areas: user.areas ?? parseAreas(user.area), id: crypto.randomUUID(), active: true });
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

export async function updateLocalUser(input: {
  id: string;
  name: string;
  role: AppUser["role"];
  area?: AreaKey;
  areas?: AreaKey[];
  active: boolean;
}) {
  const data = await readData();
  const user = data.users.find((item) => item.id === input.id);
  if (!user) return false;
  user.name = input.name;
  user.role = input.role;
  user.areas = input.role === "operator" ? input.areas ?? parseAreas(input.area) : undefined;
  user.area = input.role === "operator" ? user.areas?.[0] : undefined;
  user.active = input.active;
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

function nowIso() {
  return new Date().toISOString();
}

function nextPendingStep(order: Order, currentStepKey: AreaKey) {
  const currentIndex = order.steps.findIndex((step) => step.key === currentStepKey);
  if (currentIndex < 0) return undefined;
  return order.steps.slice(currentIndex + 1).find((step) => step.status === "pending");
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
    if (!order.groupCode) {
      order.groupCode = order.code;
      changed = true;
    }
    if (!order.priority) {
      order.priority = "normal";
      changed = true;
    }
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

  for (const item of data.stockItems) {
    if (!item.location) {
      item.location = "warehouse";
      changed = true;
    }
  }

  return { data, changed };
}

export async function nextLocalOrderCode(store: Order["store"]) {
  const data = await readData();
  return nextCodeForStore(store, data.orders.map((order) => order.code));
}

function pickLocalStepOwner(data: LocalData, area: AreaKey, fallback: string) {
  return (
    data.users.find((user) => user.active && user.role === "operator" && userAreas(user).includes(area))?.name ??
    data.users.find((user) => user.active && user.role === "operator" && !userAreas(user).length)?.name ??
    fallback
  );
}

function parseAreas(value?: string | null) {
  return (value ?? "")
    .split(",")
    .map((area) => area.trim())
    .filter(Boolean);
}

function userAreas(user: AppUser) {
  return user.areas?.length ? user.areas : parseAreas(user.area);
}

function nextCodeForStore(store: Order["store"], codes: string[]) {
  const max = codes.reduce((current, code) => {
    const match = new RegExp(`^${store}(\\d+)$`).exec(code);
    if (!match) return current;
    return Math.max(current, Number(match[1]));
  }, 0);
  return `${store}${String(max + 1).padStart(2, "0")}`;
}
