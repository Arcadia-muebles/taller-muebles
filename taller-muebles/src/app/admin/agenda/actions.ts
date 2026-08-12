"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { isReadyForDelivery } from "@/lib/metrics";
import { isProductionOrder, productionOrderGroup } from "@/lib/orders";
import { cancelLocalAgendaItem, completeLocalAgendaItem, createLocalAgendaTask, scheduleLocalOrderDelivery, updateLocalAgendaItem } from "@/lib/local-store";
import { listOrders } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import { createClient } from "@/lib/supabase/server";
import type { AgendaTimeSlot } from "@/lib/types";

const agendaItemSchema = z.object({
  itemId: z.string().min(1),
});

const scheduleDeliverySchema = z.object({
  orderId: z.string().min(1),
  notes: z.string().trim().max(500).optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timeSlot: z.enum(["AM", "PM"]).optional(),
});

const createTaskSchema = z.object({
  title: z.string().trim().min(3).max(120),
  notes: z.string().trim().max(400).optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timeSlot: z.enum(["AM", "PM"]).optional(),
});

const updateAgendaSchema = z.object({
  itemId: z.string().min(1),
  kind: z.enum(["delivery", "task"]),
  title: z.string().trim().min(3).max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeSlot: z.enum(["AM", "PM"]),
});

export async function scheduleOrderDelivery(formData: FormData) {
  const user = await requireSession(["admin", "manager"]);
  if (!(await canEditAgenda(user.role))) return;

  const parsed = scheduleDeliverySchema.safeParse({
    orderId: formData.get("orderId"),
    notes: formData.get("notes")?.toString() || undefined,
    scheduledDate: formData.get("scheduledDate")?.toString() || undefined,
    timeSlot: formData.get("timeSlot")?.toString() || undefined,
  });
  if (!parsed.success) return;

  const scheduledDate = parsed.data.scheduledDate ?? todayLocalDate();
  const timeSlot = parsed.data.timeSlot ?? currentTimeSlot();
  const orders = await listOrders();
  const order = orders.find((item) => item.id === parsed.data.orderId);
  if (!order || !isProductionOrder(order)) return;
  const groupOrders = productionOrderGroup(orders, order);
  if (!groupOrders.length || !groupOrders.every(isReadyForDelivery)) return;
  const groupOrderIds = groupOrders.map((item) => item.id);

  if (!hasSupabaseConfig()) {
    await scheduleLocalOrderDelivery({
      orderId: order.id,
      scheduledDate,
      timeSlot,
      notes: parsed.data.notes,
    });
  } else {
    const supabase = await createClient();
    const profileId = await getCurrentProfileId(supabase);
    if (!profileId) {
      throw new Error("No fue posible identificar el perfil que agenda la entrega.");
    }
    const times = timeSlotTimes(timeSlot);
    const { data: existing, error: lookupError } = await supabase
      .from("agenda_items")
      .select("id")
      .eq("kind", "delivery")
      .in("order_id", groupOrderIds)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error("Agenda lookup failed:", lookupError.message);
      throw new Error("No fue posible consultar la agenda en Supabase.");
    }

    if (existing) {
      const { error } = await supabase
        .from("agenda_items")
        .update({
          title: `Entrega ${order.groupCode || order.code}${groupOrders.length > 1 ? ` · ${groupOrders.length} productos` : ""}`,
          scheduled_date: scheduledDate,
          time_slot: timeSlot,
          start_time: times.startTime,
          end_time: times.endTime,
          notes: parsed.data.notes || null,
        })
        .eq("id", existing.id);
      if (error) {
        console.error("Agenda update failed:", error.message);
        throw new Error("No fue posible actualizar la entrega en Supabase.");
      }
    } else {
      const { error } = await supabase.from("agenda_items").insert({
        kind: "delivery",
        order_id: order.id,
        title: `Entrega ${order.groupCode || order.code}${groupOrders.length > 1 ? ` · ${groupOrders.length} productos` : ""}`,
        notes: parsed.data.notes || null,
        scheduled_date: scheduledDate,
        time_slot: timeSlot,
        start_time: times.startTime,
        end_time: times.endTime,
        created_by: profileId,
      });
      if (error) {
        console.error("Agenda insert failed:", error.message);
        throw new Error("No fue posible crear la entrega en Supabase.");
      }
    }
    const { error: auditError } = await supabase.from("audit_logs").insert(groupOrders.map((groupOrder) => ({
      order_id: groupOrder.id,
      action: "schedule_delivery",
      entity: "agenda_items",
      entity_id: existing?.id ?? order.id,
      profile_id: profileId,
      field_name: "scheduled_date",
      new_value: `${scheduledDate} ${timeSlot}`,
    })));
    if (auditError) console.error("Agenda audit insert failed:", auditError.message);
  }

  revalidateAgendaPaths(groupOrderIds);
  redirect(`/admin/agenda?date=${scheduledDate}`);
}

export async function createAgendaTask(formData: FormData) {
  const user = await requireSession(["admin", "manager"]);
  if (!(await canEditAgenda(user.role))) return;

  const parsed = createTaskSchema.safeParse({
    title: formData.get("title"),
    notes: formData.get("notes")?.toString() || undefined,
    scheduledDate: formData.get("scheduledDate")?.toString() || undefined,
    timeSlot: formData.get("timeSlot")?.toString() || undefined,
  });
  if (!parsed.success) return;

  const scheduledDate = parsed.data.scheduledDate ?? todayLocalDate();
  const timeSlot = parsed.data.timeSlot ?? currentTimeSlot();

  if (!hasSupabaseConfig()) {
    await createLocalAgendaTask({
      title: parsed.data.title,
      notes: parsed.data.notes,
      scheduledDate,
      timeSlot,
    });
  } else {
    const supabase = await createClient();
    const profileId = await getCurrentProfileId(supabase);
    if (!profileId) throw new Error("No fue posible identificar el perfil que crea la tarea.");
    const times = timeSlotTimes(timeSlot);
    const { error } = await supabase.from("agenda_items").insert({
      kind: "task",
      title: parsed.data.title,
      notes: parsed.data.notes || null,
      scheduled_date: scheduledDate,
      time_slot: timeSlot,
      start_time: times.startTime,
      end_time: times.endTime,
      created_by: profileId,
    });
    if (error) {
      console.error("Agenda task insert failed:", error.message);
      throw new Error("No fue posible crear la tarea en Supabase.");
    }
  }

  revalidateAgendaPaths();
  redirect(`/admin/agenda?date=${scheduledDate}`);
}

export async function updateAgendaItem(formData: FormData) {
  const user = await requireSession(["admin", "manager"]);
  if (!(await canEditAgenda(user.role))) return;

  const parsed = updateAgendaSchema.safeParse({
    itemId: formData.get("itemId"),
    kind: formData.get("kind"),
    title: formData.get("title")?.toString() || undefined,
    notes: formData.get("notes")?.toString() || undefined,
    scheduledDate: formData.get("scheduledDate")?.toString(),
    timeSlot: formData.get("timeSlot")?.toString(),
  });
  if (!parsed.success) return;

  const times = timeSlotTimes(parsed.data.timeSlot);
  if (!hasSupabaseConfig()) {
    await updateLocalAgendaItem(parsed.data);
  } else {
    const supabase = await createClient();
    const profileId = await getCurrentProfileId(supabase);
    if (!profileId) throw new Error("No fue posible identificar el perfil que actualiza la agenda.");
    const updatePayload = {
      title: parsed.data.kind === "task" ? parsed.data.title : undefined,
      notes: parsed.data.notes || null,
      scheduled_date: parsed.data.scheduledDate,
      time_slot: parsed.data.timeSlot,
      start_time: times.startTime,
      end_time: times.endTime,
    };
    const { error } = await supabase.from("agenda_items").update(updatePayload).eq("id", parsed.data.itemId);
    if (error) {
      console.error("Agenda item update failed:", error.message);
      throw new Error("No fue posible actualizar la agenda en Supabase.");
    }
    const { error: auditError } = await supabase.from("audit_logs").insert({
      action: "update_agenda_item",
      entity: "agenda_items",
      entity_id: parsed.data.itemId,
      profile_id: profileId,
      field_name: "schedule",
      new_value: JSON.stringify({
        scheduledDate: parsed.data.scheduledDate,
        timeSlot: parsed.data.timeSlot,
        title: parsed.data.kind === "task" ? parsed.data.title : undefined,
        notes: parsed.data.notes || "",
      }),
    });
    if (auditError) console.error("Agenda item audit insert failed:", auditError.message);
  }

  revalidateAgendaPaths();
  redirect(`/admin/agenda?date=${parsed.data.scheduledDate}`);
}

export async function completeAgendaItem(formData: FormData) {
  const user = await requireSession(["admin", "manager"]);
  if (!(await canEditAgenda(user.role))) return;

  const parsed = agendaItemSchema.safeParse({ itemId: formData.get("itemId") });
  if (!parsed.success) return;

  if (!hasSupabaseConfig()) {
    await completeLocalAgendaItem(parsed.data.itemId);
  } else {
    const supabase = await createClient();
    const profileId = await getCurrentProfileId(supabase);
    if (!profileId) throw new Error("No fue posible identificar el perfil que completa la tarea.");
    const { data: item, error: lookupError } = await supabase
      .from("agenda_items")
      .select("*")
      .eq("id", parsed.data.itemId)
      .maybeSingle();
    if (lookupError) {
      console.error("Agenda completion lookup failed:", lookupError.message);
      throw new Error("No fue posible consultar la tarea en Supabase.");
    }
    if (!item) return;

    const now = new Date().toISOString();
    const { error: completionError } = await supabase
      .from("agenda_items")
      .update({ status: "done" })
      .eq("id", item.id);
    if (completionError) {
      console.error("Agenda completion failed:", completionError.message);
      throw new Error("No fue posible completar la tarea en Supabase.");
    }
    if (item.kind === "delivery" && item.order_id) {
      await closeSupabaseOrderFromAgenda({
        supabase,
        orderId: item.order_id,
        agendaItemId: item.id,
        profileId,
        completedAt: now,
      });
    }
  }

  revalidateAgendaPaths();
}

async function closeSupabaseOrderFromAgenda({
  supabase,
  orderId,
  agendaItemId,
  profileId,
  completedAt,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  orderId: string;
  agendaItemId: string;
  profileId: string;
  completedAt: string;
}) {
  const orders = await listOrders();
  const seed = orders.find((order) => order.id === orderId);
  const groupOrders = seed ? productionOrderGroup(orders, seed) : [];
  const groupOrderIds = groupOrders.length ? groupOrders.map((order) => order.id) : [orderId];

  const { error: orderError } = await supabase
    .from("orders")
    .update({ status: "completed", condition: "delivered", completed_at: completedAt })
    .in("id", groupOrderIds);
  if (orderError) {
    console.error("Order completion from agenda failed:", orderError.message);
    throw new Error("No fue posible cerrar las órdenes asociadas a la entrega.");
  }

  const { error: stepsError } = await supabase
    .from("production_steps")
    .update({ status: "done", completed_at: completedAt, updated_by: profileId })
    .in("order_id", groupOrderIds);
  if (stepsError) {
    console.error("Production step completion from agenda failed:", stepsError.message);
    throw new Error("No fue posible cerrar las etapas asociadas a la entrega.");
  }

  const { error: auditError } = await supabase.from("audit_logs").insert(groupOrderIds.map((groupOrderId) => ({
    order_id: groupOrderId,
    action: "close_order",
    entity: "agenda_items",
    entity_id: agendaItemId,
    profile_id: profileId,
    field_name: "status",
    new_value: "completed",
  })));
  if (auditError) {
    console.error("Order completion audit failed:", auditError.message);
    throw new Error("La entrega se cerró, pero no fue posible registrar su auditoría.");
  }
}

export async function cancelAgendaItem(formData: FormData) {
  const user = await requireSession(["admin", "manager"]);
  if (!(await canEditAgenda(user.role))) return;

  const parsed = agendaItemSchema.safeParse({ itemId: formData.get("itemId") });
  if (!parsed.success) return;

  if (!hasSupabaseConfig()) {
    await cancelLocalAgendaItem(parsed.data.itemId);
  } else {
    const supabase = await createClient();
    const profileId = await getCurrentProfileId(supabase);
    if (!profileId) throw new Error("No fue posible identificar el perfil que cancela la tarea.");
    const { error } = await supabase.from("agenda_items").update({ status: "cancelled" }).eq("id", parsed.data.itemId);
    if (error) {
      console.error("Agenda cancel failed:", error.message);
      throw new Error("No fue posible cancelar la tarea en Supabase.");
    } else {
      const { error: auditError } = await supabase.from("audit_logs").insert({
        action: "cancel_agenda_item",
        entity: "agenda_items",
        entity_id: parsed.data.itemId,
        profile_id: profileId,
        field_name: "status",
        new_value: "cancelled",
      });
      if (auditError) console.error("Agenda cancellation audit insert failed:", auditError.message);
    }
  }

  revalidateAgendaPaths();
}

async function canEditAgenda(role: "admin" | "manager" | "operator" | "viewer") {
  if (role === "admin") return true;
  if (role !== "manager") return false;
  return (await getSystemSettings()).permissions.managersCanEditOrders;
}

async function getCurrentProfileId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("active", true)
    .maybeSingle();
  return profile?.id ?? null;
}

function revalidateAgendaPaths(orderIds?: string | string[]) {
  revalidatePath("/admin");
  revalidatePath("/admin/agenda");
  revalidatePath("/admin/ready");
  revalidatePath("/admin/history");
  revalidatePath("/taller");
  for (const orderId of typeof orderIds === "string" ? [orderIds] : orderIds ?? []) {
    revalidatePath(`/admin/orders/${orderId}`);
  }
}

function todayLocalDate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

function currentTimeSlot(): AgendaTimeSlot {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    timeZone: "America/Santiago",
  }).format(new Date()));
  return hour < 14 ? "AM" : "PM";
}

function timeSlotTimes(timeSlot: AgendaTimeSlot) {
  return timeSlot === "AM"
    ? { startTime: "09:00", endTime: "13:00" }
    : { startTime: "14:00", endTime: "18:00" };
}
