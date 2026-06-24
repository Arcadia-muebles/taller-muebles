import { z } from "zod";

export const documentTypeSchema = z.enum([
  "sales_note",
  "quote",
  "purchase_order",
  "warranty",
  "production_intake",
]);

export const documentStatusSchema = z.enum([
  "draft",
  "issued",
  "approved",
  "closed",
  "cancelled",
]);

const optionalMoney = z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.coerce.number().min(0, "El monto no puede ser negativo.").optional(),
);

const optionalQuantity = z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.coerce.number().min(1, "La cantidad debe ser al menos 1.").optional(),
);

const baseOrderSchema = z.object({
  store: z.enum(["LH", "LR"]),
  documentType: documentTypeSchema,
  documentStatus: documentStatusSchema,
  salesNoteNumber: z.string().trim().optional(),
  groupCode: z.string().trim().max(40, "El codigo de pedido es demasiado largo.").optional(),
  clientName: z.string().trim().min(2, "Ingresa el nombre del cliente."),
  customerContact: z.string().trim().max(120, "El contacto es demasiado largo.").optional(),
  customerAddress: z.string().trim().max(160, "La direccion es demasiado larga.").optional(),
  customerCommune: z.string().trim().max(80, "La comuna es demasiado larga.").optional(),
  customerRut: z.string().trim().max(20, "El RUT es demasiado largo.").optional(),
  customerEmail: z.string().trim().email("Ingresa un correo valido.").or(z.literal("")).optional(),
  customerPhone: z.string().trim().max(40, "El telefono es demasiado largo.").optional(),
  productName: z.string().trim().min(3, "Ingresa producto o modelo."),
  material: z.string().trim().optional(),
  color: z.string().trim().optional(),
  quantity: optionalQuantity,
  unitPrice: optionalMoney,
  subtotal: optionalMoney,
  discount: optionalMoney,
  total: optionalMoney,
  paidAmount: optionalMoney,
  entryDate: z.string().min(1, "Define fecha de ingreso."),
  deliveryDate: z.string().min(1, "Define fecha de entrega."),
  assignedTo: z.string().trim().optional(),
  observations: z.string().optional(),
  isWarranty: z.boolean(),
});

function refineOrder(value: z.infer<typeof baseOrderSchema>, context: z.RefinementCtx) {
  if (value.store === "LH") {
    if (!value.color?.trim()) {
      context.addIssue({ code: "custom", path: ["color"], message: "Ingresa color." });
    }
    return;
  }

  if (!value.material?.trim()) {
    context.addIssue({ code: "custom", path: ["material"], message: "Ingresa material." });
  }
  if (!value.color?.trim()) {
    context.addIssue({ code: "custom", path: ["color"], message: "Ingresa color." });
  }
  if (
    value.documentType !== "quote" &&
    value.total !== undefined &&
    value.paidAmount !== undefined &&
    value.paidAmount > value.total
  ) {
    context.addIssue({ code: "custom", path: ["paidAmount"], message: "El abono no puede superar el total." });
  }
}

export const orderSchema = baseOrderSchema.superRefine(refineOrder);

export type OrderFormValues = z.infer<typeof orderSchema>;

export const orderProductSchema = z.object({
  productName: z.string().trim().min(3, "Ingresa producto o modelo."),
  material: z.string().trim().optional(),
  color: z.string().trim().min(2, "Ingresa color."),
  quantity: optionalQuantity,
  unitPrice: optionalMoney,
});

export const orderProductsSchema = z.array(orderProductSchema).min(1, "Agrega al menos un producto.");

export type OrderProductFormValues = z.infer<typeof orderProductSchema>;

export const newOrderSchema = baseOrderSchema
  .omit({ productName: true, material: true, color: true, quantity: true, unitPrice: true })
  .extend({ products: orderProductsSchema })
  .superRefine((value, context) => refineOrder({
    ...value,
    productName: value.products[0]?.productName ?? "",
    material: value.products[0]?.material,
    color: value.products[0]?.color,
    quantity: value.products[0]?.quantity,
    unitPrice: value.products[0]?.unitPrice,
  }, context));

export type NewOrderFormValues = z.infer<typeof newOrderSchema>;

export function parseBooleanFormValue(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}
