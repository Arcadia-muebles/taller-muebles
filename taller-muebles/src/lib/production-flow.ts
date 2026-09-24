import type { SystemSettings } from "@/lib/types";

export const retiredProductionStepKeys = new Set(["en_blanco", "quality"]);

export function activeProductionSteps(steps: SystemSettings["production"]["steps"]) {
  return steps.filter((step) => !retiredProductionStepKeys.has(step.key));
}

export function normalizeProductionSettings(settings: SystemSettings): SystemSettings {
  return {
    ...settings,
    production: {
      ...settings.production,
      steps: activeProductionSteps(settings.production.steps),
      requireQualityApproval: false,
      autoCompleteAfterQuality: false,
    },
  };
}
