import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquareText,
  PackageCheck,
  Pencil,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { completionPercent } from "@/lib/metrics";
import { getOrder } from "@/lib/repositories/production";
import { deliveryLabel, formatDate } from "@/lib/utils";

type OrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    notFound();
  }

  const progress = completionPercent(order);

  return (
    <AppShell active="admin" user={{ name: "Rodrigo", role: "Administrador" }}>
      <header className="flex flex-col gap-4 border-b border-stone-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-stone-950"
          >
            <ArrowLeft className="size-4" />
            Volver al panel
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-stone-950">
              {order.code}
            </h1>
            <StatusBadge type="order" value={order.status} />
            {order.isWarranty ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 text-xs font-medium text-violet-700">
                <ShieldCheck className="size-3.5" />
                Garantia
              </span>
            ) : null}
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
            Seguimiento completo de venta, produccion, observaciones y estado de
            entrega para {order.client}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700">
            <Pencil className="size-4" />
            Editar
          </button>
          <button className="inline-flex h-10 items-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-medium text-white">
            <CheckCircle2 className="size-4" />
            Cerrar orden
          </button>
        </div>
      </header>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="rounded-lg border border-stone-200 bg-white">
            <div className="flex items-center gap-3 border-b border-stone-200 p-4">
              <FileText className="size-5 text-stone-500" />
              <div>
                <h2 className="text-base font-semibold">Datos de la orden</h2>
                <p className="text-sm text-stone-500">Informacion comercial y productiva.</p>
              </div>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <Info label="Cliente" value={order.client} />
              <Info label="Tienda" value={order.store} />
              <Info label="Producto" value={order.product} />
              <Info label="Material" value={order.material} />
              <Info label="Color" value={order.color} />
              <Info label="Responsable" value={order.assignedTo} />
              <Info label="Condicion" value={order.condition} />
              <Info label="Prioridad" value={order.priority} />
            </div>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white">
            <div className="flex items-center gap-3 border-b border-stone-200 p-4">
              <Clock className="size-5 text-stone-500" />
              <div>
                <h2 className="text-base font-semibold">Etapas productivas</h2>
                <p className="text-sm text-stone-500">Cada cambio quedara auditado al conectar Supabase.</p>
              </div>
            </div>
            <div className="p-4">
              <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-sm font-medium text-stone-600">{progress}% de avance</p>

              <div className="mt-5 space-y-3">
                {order.steps.map((step, index) => (
                  <div
                    key={step.key}
                    className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid size-8 shrink-0 place-items-center rounded-md bg-white text-sm font-semibold text-stone-700">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold">{step.label}</p>
                        <p className="mt-1 text-sm text-stone-500">{step.owner}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusBadge type="step" value={step.status} />
                      <p className="text-xs text-stone-500">
                        {step.completedAt
                          ? `Termino ${formatDate(step.completedAt)}`
                          : step.startedAt
                            ? `Inicio ${formatDate(step.startedAt)}`
                            : "Sin movimiento"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="size-5 text-stone-500" />
              <div>
                <h2 className="text-base font-semibold">Fechas</h2>
                <p className="text-sm text-stone-500">Compromisos de entrega.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <Info label="Ingreso" value={formatDate(order.entryDate)} />
              <Info label="Entrega" value={formatDate(order.deliveryDate)} />
              <Info label="Plazo" value={deliveryLabel(order.deliveryDate, order.status === "completed")} strong />
            </div>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <MessageSquareText className="size-5 text-stone-500" />
              <div>
                <h2 className="text-base font-semibold">Observaciones</h2>
                <p className="text-sm text-stone-500">Contexto operativo.</p>
              </div>
            </div>
            <p className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3 text-sm leading-6 text-stone-700">
              {order.observations}
            </p>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <PackageCheck className="size-5 text-stone-500" />
              <div>
                <h2 className="text-base font-semibold">Proximas acciones</h2>
                <p className="text-sm text-stone-500">Para la conexion real.</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-stone-600">
              <li>Registrar cambios en audit_logs.</li>
              <li>Permitir adjuntos desde Supabase Storage.</li>
              <li>Actualizar stock por consumo o ajuste.</li>
              <li>Notificar bloqueos y atrasos.</li>
            </ul>
          </section>
        </aside>
      </section>
    </AppShell>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">{label}</p>
      <p className={`mt-1 text-sm ${strong ? "font-semibold text-rose-600" : "font-medium text-stone-900"}`}>
        {value}
      </p>
    </div>
  );
}
