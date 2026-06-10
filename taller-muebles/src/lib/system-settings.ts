import type { SystemSettings } from "@/lib/types";

export const defaultSystemSettings: SystemSettings = {
  general: {
    businessName: "Control Produccion",
    timezone: "America/Santiago",
    workdayStart: "08:30",
    workdayEnd: "18:00",
    workdays: [1, 2, 3, 4, 5],
  },
  production: {
    steps: [
      { key: "structure", label: "Estructura", targetDays: 2, enabled: true, required: true },
      { key: "en_blanco", label: "En Blanco", targetDays: 1, enabled: true, required: true },
      { key: "cutting", label: "Corte", targetDays: 1, enabled: true, required: true },
      { key: "sewing", label: "Costura", targetDays: 2, enabled: true, required: true },
      { key: "upholstery", label: "Tapicería", targetDays: 3, enabled: true, required: true },
      { key: "quality", label: "Control Calidad", targetDays: 1, enabled: true, required: true },
      { key: "dispatch", label: "Despacho", targetDays: 1, enabled: true, required: true },
    ],
    allowParallelSteps: false,
    requireQualityApproval: true,
    autoCompleteAfterQuality: false,
  },
  orders: {
    defaultPriority: "normal",
    requireAssignedPerson: true,
    requireMaterialAndColor: true,
    requireObservationsForWarranty: true,
    enforceUniqueSalesNote: true,
    allowPastDeliveryDates: false,
    archiveCompletedAfterDays: 30,
  },
  alerts: {
    upcomingDeliveryDays: 5,
    urgentDeliveryDays: 2,
    blockedAfterHours: 24,
    stockAlertsEnabled: true,
    deliveryAlertsEnabled: true,
    blockedAlertsEnabled: true,
    dailySummaryEnabled: false,
    dailySummaryTime: "08:00",
  },
  permissions: {
    managersCanEditOrders: true,
    managersCanManageStock: true,
    operatorsCanStartSteps: true,
    operatorsCanCompleteSteps: true,
    operatorsCanBlockSteps: false,
    requireBlockReason: true,
  },
};
