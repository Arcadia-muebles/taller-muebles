"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { addLocalDocumentPayment, deleteLocalDocumentPayment, updateLocalDocumentPayment } from "@/lib/local-store";
import { getOrder, listOrders } from "@/lib/repositories/production";
import { createClient } from "@/lib/supabase/server";

const paymentSchema = z.object({ orderId: z.string().min(1), amount: z.coerce.number().positive().finite(), paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), method: z.string().trim().min(2).max(80), note: z.string().trim().max(300).optional() });
const paymentCorrectionSchema = paymentSchema.extend({ paymentId: z.string().uuid() });
const paymentDeleteSchema = z.object({ orderId: z.string().min(1), paymentId: z.string().uuid() });

export async function addDocumentPayment(formData: FormData) {
  await requireSession(["admin", "manager"]);
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error" as const, message: parsed.error.issues[0]?.message ?? "Revisa el abono." };
  const order = await getOrder(parsed.data.orderId);
  if (!order) return { status: "error" as const, message: "No se encontró la nota de venta." };
  const total = order.total ?? 0;
  if ((order.paidAmount ?? 0) + parsed.data.amount > total) return { status: "error" as const, message: "El abono supera el saldo pendiente." };
  if (!hasSupabaseConfig()) {
    const saved = await addLocalDocumentPayment(parsed.data);
    if (!saved) return { status: "error" as const, message: "No se pudo registrar el abono." };
  } else {
    const supabase = await createClient();
    const orders = (await listOrders()).filter((item) => item.groupCode === order.groupCode);
    const paidAmount = (order.paidAmount ?? 0) + parsed.data.amount;
    const paymentDb = supabase as unknown as { from: (table: string) => {
      insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    } };
    const { error: paymentError } = await paymentDb.from("order_payments").insert({ order_id: order.id, paid_at: parsed.data.paidAt, amount: parsed.data.amount, method: parsed.data.method, note: parsed.data.note || null });
    if (paymentError) return { status: "error" as const, message: paymentError.message };
    const ordersTable = supabase.from("orders") as unknown as {
      update: (patch: Record<string, unknown>) => { in: (column: string, values: string[]) => Promise<{ error: { message: string } | null }> };
    };
    const { error } = await ordersTable.update({ paid_amount: paidAmount, balance_amount: Math.max(total - paidAmount, 0), payment_method: parsed.data.method }).in("id", orders.map((item) => item.id));
    if (error) return { status: "error" as const, message: error.message };
  }
  revalidatePath("/admin/documents");
  revalidatePath(`/admin/documents/${encodeURIComponent(order.groupCode)}`);
  return { status: "success" as const, message: "Abono registrado." };
}

export async function updateDocumentPayment(input: z.infer<typeof paymentCorrectionSchema>) {
  await requireSession(["admin", "manager"]);
  const parsed = paymentCorrectionSchema.safeParse(input);
  if (!parsed.success) return { status: "error" as const, message: parsed.error.issues[0]?.message ?? "Revisa el abono." };
  const order = await getOrder(parsed.data.orderId);
  if (!order) return { status: "error" as const, message: "No se encontró la nota de venta." };
  if (!order.payments?.some((payment) => payment.id === parsed.data.paymentId)) return { status: "error" as const, message: "No se encontró el abono." };
  const correctedTotal = order.payments.reduce((sum, payment) => sum + (payment.id === parsed.data.paymentId ? parsed.data.amount : payment.amount), 0);
  if (correctedTotal > (order.total ?? 0)) return { status: "error" as const, message: "Los abonos no pueden superar el total de la nota." };
  if (!hasSupabaseConfig()) {
    const saved = await updateLocalDocumentPayment(parsed.data);
    if (!saved) return { status: "error" as const, message: "No se pudo corregir el abono." };
  } else {
    const supabase = await createClient();
    const paymentDb = supabase as unknown as { from: (table: string) => { update: (patch: Record<string, unknown>) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> } } } };
    const { error } = await paymentDb.from("order_payments").update({ paid_at: parsed.data.paidAt, amount: parsed.data.amount, method: parsed.data.method, note: parsed.data.note || null }).eq("id", parsed.data.paymentId).eq("order_id", order.id);
    if (error) return { status: "error" as const, message: error.message };
    const syncError = await syncSupabasePaymentTotals(supabase, order);
    if (syncError) return { status: "error" as const, message: syncError };
  }
  revalidateDocument(order.groupCode);
  return { status: "success" as const, message: "Abono actualizado." };
}

export async function deleteDocumentPayment(input: z.infer<typeof paymentDeleteSchema>) {
  await requireSession(["admin", "manager"]);
  const parsed = paymentDeleteSchema.safeParse(input);
  if (!parsed.success) return { status: "error" as const, message: "Abono inválido." };
  const order = await getOrder(parsed.data.orderId);
  if (!order) return { status: "error" as const, message: "No se encontró la nota de venta." };
  if (!hasSupabaseConfig()) {
    const saved = await deleteLocalDocumentPayment(parsed.data);
    if (!saved) return { status: "error" as const, message: "No se pudo eliminar el abono." };
  } else {
    const supabase = await createClient();
    const paymentDb = supabase as unknown as { from: (table: string) => { delete: () => { eq: (column: string, value: string) => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> } } } };
    const { error } = await paymentDb.from("order_payments").delete().eq("id", parsed.data.paymentId).eq("order_id", order.id);
    if (error) return { status: "error" as const, message: error.message };
    const syncError = await syncSupabasePaymentTotals(supabase, order);
    if (syncError) return { status: "error" as const, message: syncError };
  }
  revalidateDocument(order.groupCode);
  return { status: "success" as const, message: "Abono eliminado." };
}

async function syncSupabasePaymentTotals(supabase: Awaited<ReturnType<typeof createClient>>, order: NonNullable<Awaited<ReturnType<typeof getOrder>>>) {
  const paymentDb = supabase as unknown as { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => Promise<{ data: Array<{ amount: number | string; method: string }> | null; error: { message: string } | null }> } } };
  const { data, error } = await paymentDb.from("order_payments").select("amount, method").eq("order_id", order.id);
  if (error || !data) return error?.message ?? "No se pudo recalcular el saldo.";
  const paidAmount = data.reduce((sum, payment) => sum + Number(payment.amount), 0);
  if (paidAmount > (order.total ?? 0)) return "Los abonos superan el total de la nota.";
  const orders = (await listOrders()).filter((item) => item.groupCode === order.groupCode);
  const ordersTable = supabase.from("orders") as unknown as { update: (patch: Record<string, unknown>) => { in: (column: string, values: string[]) => Promise<{ error: { message: string } | null }> } };
  const result = await ordersTable.update({ paid_amount: paidAmount, balance_amount: Math.max((order.total ?? 0) - paidAmount, 0), payment_method: data.at(-1)?.method ?? null }).in("id", orders.map((item) => item.id));
  return result.error?.message;
}

function revalidateDocument(groupCode: string) {
  revalidatePath("/admin/documents");
  revalidatePath(`/admin/documents/${encodeURIComponent(groupCode)}`);
}
