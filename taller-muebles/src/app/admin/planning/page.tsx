import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock3, MoreVertical, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { cancelAgendaItem, completeAgendaItem, createAgendaTask, updateAgendaItem } from "@/app/admin/agenda/actions";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DismissibleDetails } from "@/components/dismissible-details";
import { requireSession } from "@/lib/auth";
import { listAgendaItems } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import type { AgendaItem, AgendaPriority } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const priorityOrder: AgendaPriority[] = ["critical", "high", "normal", "low"];

export default async function PlanningPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string; status?: string }>;
}) {
  const user = await requireSession(["admin", "manager"]);
  const params = searchParams ? await searchParams : {};
  const selectedDate = normalizeDateParam(params.date) ?? todayLocalDate();
  const status = params.status === "done" || params.status === "all" ? params.status : "pending";
  const [items, settings] = await Promise.all([listAgendaItems(selectedDate), getSystemSettings()]);
  const canEdit = user.role === "admin" || (user.role === "manager" && settings.permissions.managersCanEditOrders);
  const tasks = items
    .filter((item) => item.kind === "task" && item.status !== "cancelled")
    .filter((item) => status === "all" || item.status === status)
    .sort((a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority) || a.startTime.localeCompare(b.startTime));

  return (
    <AppShell active="admin" user={user}>
      <header className="page-header">
        <div>
          <p className="page-kicker">Operación diaria</p>
          <h1 className="page-title">Planificación diaria</h1>
          <p className="page-description">Organiza las tareas del día por importancia y mantén visible lo que requiere atención primero.</p>
        </div>
        <DismissibleDetails className="relative">
          <summary className={cn("btn btn-primary list-none", !canEdit && "pointer-events-none opacity-50")}>
            <Plus className="size-4" />
            Nueva tarea
          </summary>
          <div className="absolute right-0 z-30 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-stone-200 bg-white p-4 shadow-xl shadow-stone-950/10">
            <TaskForm action={createAgendaTask} selectedDate={selectedDate} disabled={!canEdit} submitLabel="Crear tarea" />
          </div>
        </DismissibleDetails>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {priorityOrder.map((priority) => (
          <PriorityMetric
            key={priority}
            priority={priority}
            count={items.filter((item) => item.kind === "task" && item.status === "pending" && item.priority === priority).length}
          />
        ))}
      </section>

      <div className="mt-5 flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link href={`/admin/planning?date=${addDays(selectedDate, -1)}&status=${status}`} className="btn btn-secondary" aria-label="Día anterior">
            <ChevronLeft className="size-4" />
          </Link>
          <label className="flex items-center gap-2 text-sm font-semibold text-stone-700">
            <CalendarDays className="size-4 text-stone-500" />
            <input type="date" value={selectedDate} className="control" readOnly />
          </label>
          <Link href={`/admin/planning?date=${addDays(selectedDate, 1)}&status=${status}`} className="btn btn-secondary" aria-label="Día siguiente">
            <ChevronRight className="size-4" />
          </Link>
          <Link href={`/admin/planning?date=${todayLocalDate()}&status=${status}`} className="btn btn-secondary">Hoy</Link>
        </div>
        <div className="flex gap-2">
          {(["pending", "done", "all"] as const).map((value) => (
            <Link
              key={value}
              href={`/admin/planning?date=${selectedDate}&status=${value}`}
              className={cn("btn", status === value ? "btn-primary" : "btn-secondary")}
            >
              {value === "pending" ? "Pendientes" : value === "done" ? "Hechas" : "Todas"}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {priorityOrder.map((priority) => {
          const priorityTasks = tasks.filter((task) => task.priority === priority);
          return (
            <section key={priority} className="panel overflow-visible">
              <header className={cn("flex items-center justify-between border-b px-4 py-3", priorityHeaderClass(priority))}>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4" />
                  <h2 className="text-sm font-semibold">{priorityLabel(priority)}</h2>
                </div>
                <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold">{priorityTasks.length}</span>
              </header>
              <div className="divide-y divide-stone-100">
                {priorityTasks.map((task) => <TaskCard key={task.id} task={task} canEdit={canEdit} />)}
                {!priorityTasks.length ? <p className="px-4 py-5 text-sm text-stone-500">Sin tareas en esta categoría.</p> : null}
              </div>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}

function TaskCard({ task, canEdit }: { task: AgendaItem; canEdit: boolean }) {
  return (
    <article className={cn("grid gap-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start", task.status === "done" && "bg-stone-50/70 opacity-70")}>
      <span className={cn("mt-0.5 grid size-9 place-items-center rounded-full", task.status === "done" ? "bg-emerald-100 text-emerald-700" : priorityBadgeClass(task.priority))}>
        {task.status === "done" ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={cn("font-semibold text-stone-950", task.status === "done" && "line-through")}>{task.title}</h3>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase", priorityBadgeClass(task.priority))}>{priorityLabel(task.priority)}</span>
        </div>
        {task.notes ? <p className="mt-1 text-sm leading-6 text-stone-600">{task.notes}</p> : null}
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-stone-500">
          <Clock3 className="size-3.5" />
          {task.timeSlot} · {formatDate(task.scheduledDate)}
        </p>
      </div>
      {canEdit && task.status === "pending" ? (
        <DismissibleDetails className="relative z-20 open:z-40">
          <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-md border border-stone-200 bg-white text-stone-500 hover:text-stone-950">
            <MoreVertical className="size-4" />
          </summary>
          <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-stone-200 bg-white p-3 shadow-xl shadow-stone-950/10">
            <TaskForm action={updateAgendaItem} selectedDate={task.scheduledDate} task={task} submitLabel="Guardar cambios" />
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-stone-100 pt-3">
              <form action={completeAgendaItem}>
                <input type="hidden" name="itemId" value={task.id} />
                <button type="submit" className="btn btn-secondary w-full"><CheckCircle2 className="size-4" />Completar</button>
              </form>
              <form action={cancelAgendaItem}>
                <input type="hidden" name="itemId" value={task.id} />
                <ConfirmSubmitButton
                  title="Quitar tarea"
                  description="La tarea se ocultará, pero conservará su registro para trazabilidad."
                  confirmLabel="Quitar"
                  pendingLabel="Quitando..."
                  trigger={<><Trash2 className="size-4" />Quitar</>}
                  triggerClassName="btn btn-secondary w-full text-rose-700"
                />
              </form>
            </div>
          </div>
        </DismissibleDetails>
      ) : null}
    </article>
  );
}

function TaskForm({
  action,
  selectedDate,
  task,
  disabled = false,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  selectedDate: string;
  task?: AgendaItem;
  disabled?: boolean;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-3">
      {task ? <><input type="hidden" name="itemId" value={task.id} /><input type="hidden" name="kind" value="task" /></> : null}
      <input type="hidden" name="returnTo" value="/admin/planning" />
      <label className="block">
        <span className="field-label">Tarea</span>
        <input name="title" defaultValue={task?.title} className="control mt-1" required minLength={3} maxLength={120} disabled={disabled} placeholder="Ej. Confirmar medidas con cliente" />
      </label>
      <label className="block">
        <span className="field-label">Importancia</span>
        <select name="priority" defaultValue={task?.priority ?? "normal"} className="control mt-1" disabled={disabled}>
          <option value="critical">Urgente</option>
          <option value="high">Alta</option>
          <option value="normal">Normal</option>
          <option value="low">Baja</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="field-label">Fecha</span>
          <input type="date" name="scheduledDate" defaultValue={selectedDate} className="control mt-1" required disabled={disabled} />
        </label>
        <label className="block">
          <span className="field-label">Bloque</span>
          <select name="timeSlot" defaultValue={task?.timeSlot ?? "AM"} className="control mt-1" disabled={disabled}>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="field-label">Detalle</span>
        <textarea name="notes" defaultValue={task?.notes} className="textarea-control mt-1 min-h-20" maxLength={400} disabled={disabled} placeholder="Responsable, contexto o resultado esperado" />
      </label>
      <button type="submit" className="btn btn-primary w-full" disabled={disabled}>{submitLabel}</button>
    </form>
  );
}

function PriorityMetric({ priority, count }: { priority: AgendaPriority; count: number }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{priorityLabel(priority)}</p>
      <p className="mt-2 text-2xl font-semibold text-stone-950">{count}</p>
      <p className="mt-1 text-xs text-stone-500">tareas pendientes</p>
    </div>
  );
}

function priorityLabel(priority: AgendaPriority) {
  return { critical: "Urgente", high: "Alta", normal: "Normal", low: "Baja" }[priority];
}

function priorityHeaderClass(priority: AgendaPriority) {
  return {
    critical: "border-rose-200 bg-rose-50 text-rose-800",
    high: "border-amber-200 bg-amber-50 text-amber-800",
    normal: "border-sky-200 bg-sky-50 text-sky-800",
    low: "border-stone-200 bg-stone-50 text-stone-700",
  }[priority];
}

function priorityBadgeClass(priority: AgendaPriority) {
  return {
    critical: "bg-rose-100 text-rose-700",
    high: "bg-amber-100 text-amber-700",
    normal: "bg-sky-100 text-sky-700",
    low: "bg-stone-100 text-stone-600",
  }[priority];
}

function normalizeDateParam(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function todayLocalDate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}
