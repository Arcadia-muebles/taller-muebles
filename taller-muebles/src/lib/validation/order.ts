import { z } from "zod";

export const orderSchema = z.object({
  store: z.enum(["LH", "LR"]),
  salesNoteNumber: z.string().trim().min(1, "Ingresa la nota de venta."),
  clientName: z.string().trim().min(2, "Ingresa el nombre del cliente."),
  productName: z.string().trim().min(3, "Ingresa producto o modelo."),
  material: z.string().trim().min(2, "Ingresa material."),
  color: z.string().trim().min(2, "Ingresa color."),
  entryDate: z.string().min(1, "Define fecha de ingreso."),
  deliveryDate: z.string().min(1, "Define fecha de entrega."),
  priority: z.enum(["normal", "high", "critical"]),
  assignedTo: z.string().trim().min(1, "Asigna responsable inicial."),
  observations: z.string().optional(),
  isWarranty: z.boolean(),
});

export type OrderFormValues = z.infer<typeof orderSchema>;

export function parseBooleanFormValue(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}
