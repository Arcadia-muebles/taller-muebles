import { z } from "zod";

export const orderSchema = z.object({
  store: z.enum(["LH", "LR"]),
  salesNoteNumber: z.string().trim().min(1, "Ingresa la nota de venta."),
  productName: z.string().trim().min(3, "Ingresa producto o modelo."),
  material: z.string().trim().min(2, "Ingresa material."),
  color: z.string().trim().min(2, "Ingresa color."),
  entryDate: z.string().min(1, "Define fecha de ingreso."),
  deliveryDate: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional(),
  ),
  priority: z.enum(["normal", "high", "critical"]),
  width: z.coerce.number({ message: "Ingresa el ancho." }).int().positive("Debe ser mayor que 0."),
  depth: z.coerce.number({ message: "Ingresa la profundidad." }).int().positive("Debe ser mayor que 0."),
  height: z.coerce.number({ message: "Ingresa el alto." }).int().positive("Debe ser mayor que 0."),
  observations: z.string().optional(),
  isWarranty: z.boolean(),
});

export type OrderFormValues = z.infer<typeof orderSchema>;

export function parseBooleanFormValue(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}
