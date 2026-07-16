import type { Metadata } from "next";
import Image from "next/image";
import { AlertCircle, CalendarDays, Check, Circle, Clock3, PackageCheck } from "lucide-react";
import { brand } from "@/lib/brand";
import { getClientPortalOrder } from "@/lib/client-portal";
import type { OrderStatus, StepStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Seguimiento de pedido | ARCADIA",
  description: "Consulta el estado de producción de tu pedido.",
  robots: { index: false, follow: false },
};

export default async function ClientTrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getClientPortalOrder(token);

  if (!order) return <UnavailableLink />;

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-6 text-stone-950 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-5 border-b border-stone-300 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Image src={brand.logo} alt="La Reina · Muebles en cuero" width={1600} height={874} className="h-auto w-36" priority unoptimized />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Portal Cliente</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Seguimiento de tu pedido</h1>
            <p className="mt-2 text-sm text-stone-600">Hola, {order.client}. Este es el estado actualizado de tu nota {order.code}.</p>
          </div>
          <StatusPill status={order.status} />
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Pedido" value={order.code} icon={<PackageCheck className="size-5" />} />
          <SummaryCard label="Ingresó" value={formatDate(order.entryDate)} icon={<Clock3 className="size-5" />} />
          <SummaryCard label="Entrega estimada" value={formatDate(order.deliveryDate)} icon={<CalendarDays className="size-5" />} />
        </section>

        <section className="mt-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm shadow-stone-200/40 sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Avance general</p>
              <p className="mt-1 text-lg font-semibold">{progressMessage(order.progress)}</p>
            </div>
            <p className="text-3xl font-semibold tabular-nums">{order.progress}%</p>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${order.progress}%` }} />
          </div>
        </section>

        <div className="mt-6 space-y-4">
          {order.items.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm shadow-stone-200/40">
              <div className="flex flex-col gap-3 border-b border-stone-200 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">{item.code}</p>
                  <h2 className="mt-1 text-xl font-semibold">{item.product}</h2>
                  <p className="mt-1 text-sm text-stone-600">Color: {item.color}{item.quantity > 1 ? ` · Cantidad: ${item.quantity}` : ""}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-stone-600">{item.progress}%</span>
              </div>
              <ol className="grid gap-0 p-5 sm:grid-cols-2 lg:grid-cols-4">
                {item.steps.map((step, index) => (
                  <li key={step.key} className="relative flex gap-3 border-l border-stone-200 pb-5 pl-5 last:pb-0 sm:border-l-0 sm:border-t sm:pb-0 sm:pl-0 sm:pt-5">
                    <StepIcon status={step.status} />
                    <div>
                      <p className="text-sm font-semibold">{step.label}</p>
                      <p className="mt-0.5 text-xs text-stone-500">{stepLabel(step.status, index, item.steps)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>

        <footer className="mt-8 border-t border-stone-300 pt-5 text-center text-xs leading-5 text-stone-500">
          Este enlace es privado. No lo publiques ni lo reenvíes fuera de tu empresa.
        </footer>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm shadow-stone-200/40">
      <span className="grid size-9 place-items-center rounded-lg bg-stone-100 text-stone-600">{icon}</span>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: OrderStatus }) {
  const blocked = status === "blocked";
  const done = status === "completed";
  return (
    <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${blocked ? "border-amber-200 bg-amber-50 text-amber-800" : done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-sky-200 bg-sky-50 text-sky-800"}`}>
      {blocked ? <AlertCircle className="size-4" /> : done ? <Check className="size-4" /> : <Clock3 className="size-4" />}
      {publicStatusLabel(status)}
    </span>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") return <span className="absolute -left-3 grid size-6 place-items-center rounded-full bg-emerald-600 text-white sm:-top-3 sm:left-0"><Check className="size-3.5" /></span>;
  if (status === "active") return <span className="absolute -left-3 grid size-6 place-items-center rounded-full bg-sky-600 text-white sm:-top-3 sm:left-0"><Clock3 className="size-3.5" /></span>;
  if (status === "blocked") return <span className="absolute -left-3 grid size-6 place-items-center rounded-full bg-amber-500 text-white sm:-top-3 sm:left-0"><AlertCircle className="size-3.5" /></span>;
  return <span className="absolute -left-3 grid size-6 place-items-center rounded-full border border-stone-300 bg-white text-stone-400 sm:-top-3 sm:left-0"><Circle className="size-3" /></span>;
}

function UnavailableLink() {
  return (
    <main className="grid min-h-screen place-items-center bg-stone-100 p-6">
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-7 text-center shadow-sm">
        <AlertCircle className="mx-auto size-9 text-stone-400" />
        <h1 className="mt-4 text-xl font-semibold">Enlace no disponible</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">Este acceso venció, fue revocado o no es válido. Solicita un enlace nuevo a la persona que gestiona tu pedido.</p>
      </div>
    </main>
  );
}

function publicStatusLabel(status: OrderStatus) {
  if (status === "completed") return "Pedido terminado";
  if (status === "blocked") return "Requiere revisión";
  if (status === "quality_control") return "En revisión final";
  if (status === "scheduled" || status === "draft") return "Pedido recibido";
  if (status === "cancelled") return "Pedido cancelado";
  return "En producción";
}

function progressMessage(progress: number) {
  if (progress >= 100) return "Tu pedido está terminado";
  if (progress > 0) return "Tu pedido está en producción";
  return "Tu pedido fue recibido";
}

function stepLabel(status: StepStatus, index: number, steps: Array<{ status: StepStatus }>) {
  if (status === "done") return "Completado";
  if (status === "active") return "En proceso";
  if (status === "blocked") return "En revisión";
  return steps.slice(0, index).every((step) => step.status === "done") ? "Próximo" : "Pendiente";
}
