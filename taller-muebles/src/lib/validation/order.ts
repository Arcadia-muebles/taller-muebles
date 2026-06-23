import { z } from "zod";

export const orderSchema = z.object({
  store: z.enum(["LH", "LR"]),
  salesNoteNumber: z.string().trim().optional(),
  groupCode: z.string().trim().max(40, "El código de pedido es demasiado largo.").optional(),
  clientName: z.string().trim().min(2, "Ingresa el nombre del cliente."),
  productName: z.string().trim().min(3, "Ingresa producto o modelo."),
  material: z.string().trim().min(2, "Ingresa material."),
  color: z.string().trim().min(2, "Ingresa color."),
  entryDate: z.string().min(1, "Define fecha de ingreso."),
  deliveryDate: z.string().min(1, "Define fecha de entrega."),
  assignedTo: z.string().trim().optional(),
  observations: z.string().optional(),
  isWarranty: z.boolean(),
});

export type OrderFormValues = z.infer<typeof orderSchema>;

export const orderProductSchema = z.object({
  productName: z.string().trim().min(3, "Ingresa producto o modelo."),
  material: z.string().trim().min(2, "Ingresa material."),
  color: z.string().trim().min(2, "Ingresa color."),
});

export const orderProductsSchema = z.array(orderProductSchema).min(1, "Agrega al menos un producto.");

export type OrderProductFormValues = z.infer<typeof orderProductSchema>;

export const newOrderSchema = orderSchema
  .omit({ productName: true, material: true, color: true })
  .extend({ products: orderProductsSchema });

export type NewOrderFormValues = z.infer<typeof newOrderSchema>;

export function parseBooleanFormValue(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}
