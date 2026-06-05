"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { saveSystemSettings as persistSystemSettings } from "@/lib/repositories/settings";
import type { SystemSettings } from "@/lib/types";

const boolean = z.boolean();
const settingsSchema = z.object({
  general: z.object({
    businessName: z.string().trim().min(2).max(80),
    timezone: z.string().trim().min(3).max(80),
    workdayStart: z.string().regex(/^\d{2}:\d{2}$/),
    workdayEnd: z.string().regex(/^\d{2}:\d{2}$/),
    workdays: z.array(z.number().int().min(0).max(6)).min(1),
  }),
  production: z.object({
    steps: z.array(z.object({
      key: z.enum(["structure", "cutting", "sewing", "upholstery", "quality"]),
      label: z.string().trim().min(2).max(40),
      targetDays: z.number().int().min(0).max(90),
      enabled: boolean,
      required: boolean,
    })).length(5),
    allowParallelSteps: boolean,
    requireQualityApproval: boolean,
    autoCompleteAfterQuality: boolean,
  }),
  orders: z.object({
    defaultPriority: z.enum(["normal", "high", "critical"]),
    requireAssignedPerson: boolean,
    requireMaterialAndColor: boolean,
    requireObservationsForWarranty: boolean,
    enforceUniqueSalesNote: boolean,
    allowPastDeliveryDates: boolean,
    archiveCompletedAfterDays: z.number().int().min(0).max(3650),
  }),
  alerts: z.object({
    upcomingDeliveryDays: z.number().int().min(1).max(90),
    urgentDeliveryDays: z.number().int().min(0).max(30),
    blockedAfterHours: z.number().int().min(1).max(720),
    stockAlertsEnabled: boolean,
    deliveryAlertsEnabled: boolean,
    blockedAlertsEnabled: boolean,
    dailySummaryEnabled: boolean,
    dailySummaryTime: z.string().regex(/^\d{2}:\d{2}$/),
  }),
  permissions: z.object({
    managersCanEditOrders: boolean,
    managersCanManageStock: boolean,
    operatorsCanStartSteps: boolean,
    operatorsCanCompleteSteps: boolean,
    operatorsCanBlockSteps: boolean,
    requireBlockReason: boolean,
  }),
}).superRefine((settings, context) => {
  if (settings.general.workdayEnd <= settings.general.workdayStart) {
    context.addIssue({ code: "custom", path: ["general", "workdayEnd"], message: "El fin de jornada debe ser posterior al inicio." });
  }
  if (!settings.production.steps.some((step) => step.enabled)) {
    context.addIssue({ code: "custom", path: ["production", "steps"], message: "Debe existir al menos una etapa activa." });
  }
  const qualityEnabled = settings.production.steps.find((step) => step.key === "quality")?.enabled;
  if (!qualityEnabled && (settings.production.requireQualityApproval || settings.production.autoCompleteAfterQuality)) {
    context.addIssue({ code: "custom", path: ["production"], message: "Activa la etapa de revisión para exigir o automatizar calidad." });
  }
});

export async function saveSystemSettings(input: SystemSettings) {
  const user = await requireSession(["admin"]);
  const parsed = settingsSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos marcados e intenta nuevamente." };
  }

  try {
    await persistSystemSettings({
      ...parsed.data,
      updatedAt: new Date().toISOString(),
      updatedBy: user.name,
    });
  } catch (error) {
    console.error("System settings save failed:", error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No fue posible guardar las reglas.",
    };
  }
  revalidatePath("/admin/settings");
  return { ok: true, message: "Reglas guardadas correctamente." };
}
