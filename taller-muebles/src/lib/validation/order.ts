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

const requiredText = (message: string, min = 1) =>
  z.preprocess(
    (value) => value === null || value === undefined ? "" : value,
    z.string().trim().min(min, message),
  );

const baseOrderSchema = z.object({
  store: z.enum(["LH", "LR"]),
  documentType: documentTypeSchema,
  documentStatus: documentStatusSchema,
  salesNoteNumber: z.string().trim().optional(),
  groupCode: z.string().trim().max(40, "El codigo de pedido es demasiado largo.").optional(),
  clientName: requiredText("Ingresa el nombre del cliente.", 2),
  customerContact: z.string().trim().max(120, "El contacto es demasiado largo.").optional(),
  customerAddress: z.string().trim().max(160, "La direccion es demasiado larga.").optional(),
  customerCommune: z.string().trim().max(80, "La comuna es demasiado larga.").optional(),
  customerRut: z.string().trim().max(20, "El RUT es demasiado largo.").optional(),
  customerEmail: z.string().trim().email("Ingresa un correo valido.").or(z.literal("")).optional(),
  customerPhone: z.string().trim().max(40, "El telefono es demasiado largo.").optional(),
  productName: requiredText("Ingresa producto o modelo.", 3),
  material: z.string().trim().optional(),
  color: z.string().trim().optional(),
  quantity: optionalQuantity,
  unitPrice: optionalMoney,
  subtotal: optionalMoney,
  discount: optionalMoney,
  total: optionalMoney,
  paidAmount: optionalMoney,
  sellerName: z.string().trim().max(80, "El vendedor es demasiado largo.").optional(),
  paymentMethod: z.string().trim().max(80, "El medio de pago es demasiado largo.").optional(),
  deliveryTerms: z.string().trim().max(500, "Las condiciones son demasiado largas.").optional(),
  entryDate: requiredText("Define fecha de ingreso."),
  deliveryDate: requiredText("Define fecha de entrega."),
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
  productName: requiredText("Ingresa producto o modelo.", 3),
  material: z.string().trim().optional(),
  color: requiredText("Ingresa color.", 2),
  quantity: optionalQuantity,
  unitPrice: optionalMoney,
});

export const orderProductsSchema = z.array(orderProductSchema).min(1, "Agrega al menos un producto.");

export type OrderProductFormValues = z.infer<typeof orderProductSchema>;

export const newOrderSchema = baseOrderSchema
  .omit({ productName: true, material: true, color: true, quantity: true, unitPrice: true })
  .extend({ products: orderProductsSchema })
  .superRefine((value, context) => {
    if (value.store === "LR") {
      value.products.forEach((product, index) => {
        if (!product.material?.trim()) {
          context.addIssue({
            code: "custom",
            path: ["products", index, "material"],
            message: "Ingresa material.",
          });
        }
      });
    }

    if (
      value.documentType !== "quote" &&
      value.total !== undefined &&
      value.paidAmount !== undefined &&
      value.paidAmount > value.total
    ) {
      context.addIssue({ code: "custom", path: ["paidAmount"], message: "El abono no puede superar el total." });
    }
  });

export type NewOrderFormValues = z.infer<typeof newOrderSchema>;

export function parseBooleanFormValue(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}
