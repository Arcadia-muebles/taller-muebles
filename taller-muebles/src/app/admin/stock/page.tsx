import { ArrowDown, ArrowUp, Boxes, Plus, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DeactivateStockButton } from "@/components/deactivate-stock-button";
import { StockAdjustmentButton } from "@/components/stock-adjustment-button";
import { StockCreateForm } from "@/components/stock-create-form";
import { requireSession } from "@/lib/auth";
import { listStockItems, listStockMovements } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import type { StockItem, StockMovement } from "@/lib/types";

export default async function StockPage() {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const [items, movements, settings] = await Promise.all([listStockItems(), listStockMovements(), getSystemSettings()]);
  const critical = items.filter((item) => item.available <= item.minimum);
  const canEdit = user.role === "admin" || (user.role === "manager" && settings.permissions.managersCanManageStock);

  return (
    <AppShell active="admin" user={user}>
      <header className="page-header">
        <div className="min-w-0">
          <p className="page-kicker">Stock</p>
          <h1 className="page-title">Materiales y alertas</h1>
          <p className="page-description max-w-2xl">
            Control inicial de cuero, madera, espuma y materiales que pueden frenar produccion.
          </p>
        </div>
        {canEdit ? (
          <a href="#nuevo-material" className="btn btn-primary">
            <Plus className="size-4" />
            Nuevo material
          </a>
        ) : null}
      </header>

      {canEdit ? <StockCreateForm /> : null}

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="panel-pad">
          <Boxes className="size-5 text-stone-500" />
          <p className="mt-3 text-3xl font-semibold">{items.length}</p>
          <p className="mt-1 text-sm text-stone-500">Materiales activos</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <TriangleAlert className="size-5 text-amber-700" />
          <p className="mt-3 text-3xl font-semibold text-amber-950">{critical.length}</p>
          <p className="mt-1 text-sm text-amber-800">Bajo minimo</p>
        </div>
      </section>

      <section className="panel mt-5">
        <div className="panel-header">
          <h2 className="panel-title">Inventario base</h2>
          <p className="panel-description">Primera vista para validar reglas antes de automatizar consumos.</p>
        </div>

        <div className="grid gap-3 p-3 xl:hidden">
          {items.map((item) => <StockCard key={item.id} item={item} canEdit={canEdit} />)}
          {!items.length ? <EmptyState text="No hay materiales registrados." /> : null}
        </div>

        <div className="hidden xl:block">
          <table className="w-full table-fixed">
            <thead className="table-head">
              <tr>
                <th className="px-3 py-3">Material</th>
                <th className="px-3 py-3">Categoria</th>
                <th className="px-3 py-3">Disponible</th>
                <th className="px-3 py-3">Minimo</th>
                <th className="px-3 py-3">Unidad</th>
                <th className="px-3 py-3">Ubicacion</th>
                {canEdit ? <th className="px-3 py-3">Accion</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-stone-100">
                  <td className="px-3 py-3 text-sm font-medium"><span className="block truncate">{item.name}</span></td>
                  <td className="px-3 py-3 text-sm text-stone-600"><span className="block truncate">{item.category}</span></td>
                  <td className="px-3 py-3 text-sm font-semibold">{item.available}</td>
                  <td className="px-3 py-3 text-sm text-stone-600">{item.minimum}</td>
                  <td className="px-3 py-3 text-sm text-stone-600"><span className="block truncate">{item.unit}</span></td>
                  <td className="px-3 py-3 text-sm text-stone-600">{item.store}</td>
                  {canEdit ? (
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StockAdjustmentButton item={item} />
                        <DeactivateStockButton itemId={item.id} itemName={item.name} />
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="px-4 py-10 text-center text-sm text-stone-500">No hay materiales registrados.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel mt-5">
        <div className="panel-header">
          <h2 className="panel-title">Ultimos movimientos</h2>
          <p className="panel-description">Entradas, consumos y ajustes registrados.</p>
        </div>
        <div className="divide-y divide-stone-100">
          {movements.slice(0, 12).map((movement) => <MovementRow key={movement.id} movement={movement} />)}
          {!movements.length ? <p className="p-6 text-sm text-stone-500">Aun no hay movimientos registrados.</p> : null}
        </div>
      </section>
    </AppShell>
  );
}

function StockCard({ item, canEdit }: { item: StockItem; canEdit: boolean }) {
  return (
    <article className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-950">{item.name}</p>
          <p className="mt-1 truncate text-xs text-stone-500">{item.category} · {item.store}</p>
        </div>
        <p className="text-sm font-semibold">{item.available} <span className="text-xs font-medium text-stone-500">{item.unit}</span></p>
      </div>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <Info label="Alerta bajo" value={String(item.minimum)} />
        <Info label="Ubicacion" value={item.store} />
      </div>
      {canEdit ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <StockAdjustmentButton item={item} />
          <DeactivateStockButton itemId={item.id} itemName={item.name} />
        </div>
      ) : null}
    </article>
  );
}

function MovementRow({ movement }: { movement: StockMovement }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className={movement.type === "out" ? "grid size-9 shrink-0 place-items-center rounded-md bg-rose-50 text-rose-700" : "grid size-9 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700"}>
          {movement.type === "out" ? <ArrowDown className="size-4" /> : <ArrowUp className="size-4" />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{movement.materialName}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">{movement.notes}</p>
        </div>
      </div>
      <div className="shrink-0 text-left sm:text-right">
        <p className="text-sm font-semibold">{movement.type === "out" ? "-" : movement.type === "in" ? "+" : "="}{movement.quantity}</p>
        <p className="text-xs text-stone-500">{new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(movement.createdAt))}</p>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-stone-200 bg-white p-2">
      <p className="font-medium uppercase tracking-[0.12em] text-stone-400">{label}</p>
      <p className="mt-1 truncate font-semibold text-stone-700">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}
