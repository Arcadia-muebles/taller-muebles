"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { isReadyForDelivery } from "@/lib/metrics";
import { cancelLocalAgendaItem, completeLocalAgendaItem, createLocalAgendaTask, listLocalAgendaItems, scheduleLocalExternalOrderDelivery, scheduleLocalOrderDelivery } from "@/lib/local-store";
import { listOrders } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import { createClient } from "@/lib/supabase/server";
import type { AgendaTimeSlot } from "@/lib/types";

const agendaItemSchema = z.object({
  itemId: z.string().min(1),
});

const scheduleDeliverySchema = z.object({
  orderId: z.string().min(1),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timeSlot: z.enum(["AM", "PM"]).optional(),
});

const createTaskSchema = z.object({
  title: z.string().trim().min(3).max(120),
  notes: z.string().trim().max(400).optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timeSlot: z.enum(["AM", "PM"]).optional(),
});

export async function scheduleOrderDelivery(formData: FormData) {
  const user = await requireSession(["admin", "manager"]);
  if (!(await canEditAgenda(user.role))) return;

  const parsed = scheduleDeliverySchema.safeParse({
    orderId: formData.get("orderId"),
    scheduledDate: formData.get("scheduledDate")?.toString() || undefined,
    timeSlot: formData.get("timeSlot")?.toString() || undefined,
  });
  if (!parsed.success) return;

  const scheduledDate = parsed.data.scheduledDate ?? todayLocalDate();
  const timeSlot = parsed.data.timeSlot ?? currentTimeSlot();
  const order = (await listOrders()).find((item) => item.id === parsed.data.orderId);
  if (!order || !isReadyForDelivery(order)) return;

  if (!hasSupabaseConfig()) {
    await scheduleLocalOrderDelivery({
      orderId: order.id,
      scheduledDate,
      timeSlot,
    });
  } else {
    const supabase = await createClient();
    const profileId = await getCurrentProfileId(supabase);
    if (!profileId) {
      await scheduleWithLocalFallback(order, scheduledDate, timeSlot);
      revalidateAgendaPaths(order.id);
      redirect(`/admin/agenda?date=${scheduledDate}&scheduled=local`);
    }
    const times = timeSlotTimes(timeSlot);
    const { data: existing, error: lookupError } = await supabase
      .from("agenda_items")
      .select("id")
      .eq("kind", "delivery")
      .eq("order_id", order.id)
      .eq("status", "pending")
      .maybeSingle();

    if (lookupError) {
      console.error("Agenda lookup failed, using local fallback:", lookupError.message);
      await scheduleWithLocalFallback(order, scheduledDate, timeSlot);
      revalidateAgendaPaths(order.id);
      redirect(`/admin/agenda?date=${scheduledDate}&scheduled=local`);
    }

    if (existing) {
      const { error } = await supabase
        .from("agenda_items")
        .update({
          scheduled_date: scheduledDate,
          time_slot: timeSlot,
          start_time: times.startTime,
          end_time: times.endTime,
        })
        .eq("id", existing.id);
      if (error) {
        console.error("Agenda update failed, using local fallback:", error.message);
        await scheduleWithLocalFallback(order, scheduledDate, timeSlot);
        revalidateAgendaPaths(order.id);
        redirect(`/admin/agenda?date=${scheduledDate}&scheduled=local`);
      }
    } else {
      const { error } = await supabase.from("agenda_items").insert({
        kind: "delivery",
        order_id: order.id,
        title: `Entrega ${order.code}`,
        notes: `${order.client} · ${order.product}`,
        scheduled_date: scheduledDate,
        time_slot: timeSlot,
        start_time: times.startTime,
        end_time: times.endTime,
        created_by: profileId,
      });
      if (error) {
        console.error("Agenda insert failed, using local fallback:", error.message);
        await scheduleWithLocalFallback(order, scheduledDate, timeSlot);
        revalidateAgendaPaths(order.id);
        redirect(`/admin/agenda?date=${scheduledDate}&scheduled=local`);
      }
    }
    const { error: auditError } = await supabase.from("audit_logs").insert({
      order_id: order.id,
      action: "schedule_delivery",
      entity: "agenda_items",
      entity_id: existing?.id ?? order.id,
      profile_id: profileId,
      field_name: "scheduled_date",
      new_value: `${scheduledDate} ${timeSlot}`,
    });
    if (auditError) console.error("Agenda audit insert failed:", auditError.message);
  }

  revalidateAgendaPaths(order.id);
  redirect(`/admin/agenda?date=${scheduledDate}`);
}

async function scheduleWithLocalFallback(
  order: Awaited<ReturnType<typeof listOrders>>[number],
  scheduledDate: string,
  timeSlot: AgendaTimeSlot,
) {
  await scheduleLocalExternalOrderDelivery({
    orderId: order.id,
    orderCode: order.code,
    client: order.client,
    product: order.product,
    scheduledDate,
    timeSlot,
  });
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
    if (!profileId) return;
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
      console.error("Agenda task insert failed, using local fallback:", error.message);
      await createLocalAgendaTask({
        title: parsed.data.title,
        notes: parsed.data.notes,
        scheduledDate,
        timeSlot,
      });
      revalidateAgendaPaths();
      redirect(`/admin/agenda?date=${scheduledDate}&scheduled=local`);
    }
  }

  revalidateAgendaPaths();
  redirect(`/admin/agenda?date=${scheduledDate}`);
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
    if (!profileId) return;
    const { data: item, error: lookupError } = await supabase
      .from("agenda_items")
      .select("*")
      .eq("id", parsed.data.itemId)
      .maybeSingle();
    if (lookupError) {
      console.error("Agenda completion lookup failed, using local fallback:", lookupError.message);
      await completeLocalFallbackItem(parsed.data.itemId, supabase, profileId);
      revalidateAgendaPaths();
      return;
    }
    if (!item) return;

    const now = new Date().toISOString();
    await supabase.from("agenda_items").update({ status: "done" }).eq("id", item.id);
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

async function completeLocalFallbackItem(
  itemId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
) {
  const item = (await listLocalAgendaItems()).find((agendaItem) => agendaItem.id === itemId);
  if (!item) return;
  await completeLocalAgendaItem(itemId);
  if (item.kind === "delivery" && item.orderId) {
    await closeSupabaseOrderFromAgenda({
      supabase,
      orderId: item.orderId,
      agendaItemId: item.id,
      profileId,
      completedAt: new Date().toISOString(),
    });
  }
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
  await supabase
    .from("orders")
    .update({ status: "completed", condition: "delivered", completed_at: completedAt })
    .eq("id", orderId);
  await supabase
    .from("production_steps")
    .update({ status: "done", completed_at: completedAt, updated_by: profileId })
    .eq("order_id", orderId);
  await supabase.from("audit_logs").insert({
    order_id: orderId,
    action: "close_order",
    entity: "agenda_items",
    entity_id: agendaItemId,
    profile_id: profileId,
    field_name: "status",
    new_value: "completed",
  });
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
    const { error } = await supabase.from("agenda_items").update({ status: "cancelled" }).eq("id", parsed.data.itemId);
    if (error) {
      console.error("Agenda cancel failed, using local fallback:", error.message);
      await cancelLocalAgendaItem(parsed.data.itemId);
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

function revalidateAgendaPaths(orderId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/agenda");
  revalidatePath("/admin/ready");
  revalidatePath("/admin/history");
  revalidatePath("/taller");
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
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
