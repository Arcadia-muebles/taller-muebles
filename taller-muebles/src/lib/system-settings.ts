import type { SystemSettings } from "@/lib/types";

export const defaultSystemSettings: SystemSettings = {
  general: {
    businessName: "Control Producción",
    timezone: "America/Santiago",
    workdayStart: "08:30",
    workdayEnd: "18:00",
    workdays: [1, 2, 3, 4, 5],
  },
  production: {
    steps: [
      { key: "structure", label: "Estructura", targetDays: 2, enabled: true, required: true },
      { key: "cutting", label: "Corte", targetDays: 1, enabled: true, required: true },
      { key: "sewing", label: "Costura", targetDays: 2, enabled: true, required: true },
      { key: "upholstery", label: "Tapicería", targetDays: 3, enabled: true, required: true },
      { key: "dispatch", label: "Terminado", targetDays: 1, enabled: true, required: true },
    ],
    allowParallelSteps: false,
    requireQualityApproval: false,
    autoCompleteAfterQuality: false,
  },
  orders: {
    defaultPriority: "normal",
    requireAssignedPerson: true,
    requireMaterialAndColor: true,
    requireObservationsForWarranty: true,
    enforceUniqueSalesNote: false,
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
