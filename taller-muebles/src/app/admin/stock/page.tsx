import { ArrowDown, ArrowUp, Boxes, Plus, TriangleAlert } from "lucide-react";
import { createStockItem } from "@/app/admin/stock/actions";
import { AppShell } from "@/components/app-shell";
import { StockAdjustmentButton } from "@/components/stock-adjustment-button";
import { DeactivateStockButton } from "@/components/deactivate-stock-button";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth";
import { getSystemSettings } from "@/lib/repositories/settings";
import { listStockItems, listStockMovements } from "@/lib/repositories/production";

export default async function StockPage() {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const [items, movements, settings] = await Promise.all([listStockItems(), listStockMovements(), getSystemSettings()]);
  const critical = items.filter((item) => item.available <= item.minimum);
  const canEdit = user.role === "admin" || (user.role === "manager" && settings.permissions.managersCanManageStock);

  return (
    <AppShell active="admin" user={user}>
      <header className="flex flex-col gap-4 border-b border-stone-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
            Stock
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Materiales y alertas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            Control inicial de cuero, madera, espuma y materiales que pueden frenar produccion.
          </p>
        </div>
        {canEdit ? (
          <a href="#nuevo-material" className="inline-flex h-10 items-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-medium text-white">
            <Plus className="size-4" />
            Nuevo material
          </a>
        ) : null}
      </header>

      {canEdit ? (
        <form id="nuevo-material" action={createStockItem} className="mt-5 rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-base font-semibold">Registrar material</h2>
          <p className="mt-1 text-sm text-stone-500">
            Las cantidades disponible y minima se registran usando la misma unidad de medida.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-6">
            <label className="grid gap-1.5 text-xs font-medium text-stone-600 md:col-span-2">
              Material
              <input name="name" required placeholder="Ej. Cuero negro" className="h-10 rounded-md border border-stone-200 px-3 text-sm text-stone-950" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-stone-600">
              Categoria
              <input name="category" required placeholder="Ej. Cuero" className="h-10 rounded-md border border-stone-200 px-3 text-sm text-stone-950" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-stone-600">
              Unidad de medida
              <select name="unit" required defaultValue="unidad" className="h-10 rounded-md border border-stone-200 px-3 text-sm text-stone-950">
                <option value="unidad">Unidad</option>
                <option value="metro">Metro</option>
                <option value="m2">Metro cuadrado</option>
                <option value="kg">Kilogramo</option>
                <option value="litro">Litro</option>
                <option value="plancha">Plancha</option>
                <option value="rollo">Rollo</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-stone-600">
              Cantidad disponible
              <input name="available" required type="number" min="0" step="1" placeholder="0" className="h-10 rounded-md border border-stone-200 px-3 text-sm text-stone-950" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-stone-600">
              Alerta bajo
              <input name="minimum" required type="number" min="0" step="1" placeholder="0" className="h-10 rounded-md border border-stone-200 px-3 text-sm text-stone-950" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-stone-600">
              Ubicacion
              <select name="store" defaultValue="general" className="h-10 rounded-md border border-stone-200 px-3 text-sm text-stone-950">
                <option value="general">General</option>
                <option value="LH">LH</option>
                <option value="LR">LR</option>
              </select>
            </label>
            <SubmitButton pendingLabel="Agregando..." className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-medium text-white disabled:opacity-50">
              <Plus className="size-4" />
              Agregar
            </SubmitButton>
          </div>
        </form>
      ) : null}

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-stone-200 bg-white p-4">
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

      <section className="mt-5 rounded-lg border border-stone-200 bg-white">
        <div className="border-b border-stone-200 p-4">
          <h2 className="text-base font-semibold">Inventario base</h2>
          <p className="text-sm text-stone-500">Primera vista para validar reglas antes de automatizar consumos.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
              <tr>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Cantidad disponible</th>
                <th className="px-4 py-3">Alerta bajo</th>
                <th className="px-4 py-3">Unidad de medida</th>
                <th className="px-4 py-3">Ubicacion</th>
                {canEdit ? <th className="px-4 py-3">Accion</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-stone-100">
                  <td className="px-4 py-3 text-sm font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-sm text-stone-600">{item.category}</td>
                  <td className="px-4 py-3 text-sm font-semibold">
                    {item.available}
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-600">
                    {item.minimum}
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-600">{item.unit}</td>
                  <td className="px-4 py-3 text-sm text-stone-600">{item.store}</td>
                  {canEdit ? (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StockAdjustmentButton item={item} />
                        <DeactivateStockButton itemId={item.id} itemName={item.name} />
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="px-4 py-10 text-center text-sm text-stone-500">
                    No hay materiales registrados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-stone-200 bg-white">
        <div className="border-b border-stone-200 p-4">
          <h2 className="text-base font-semibold">Últimos movimientos</h2>
          <p className="text-sm text-stone-500">Entradas, consumos y ajustes registrados.</p>
        </div>
        <div className="divide-y divide-stone-100">
          {movements.slice(0, 12).map((movement) => (
            <div key={movement.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className={movement.type === "out" ? "grid size-9 place-items-center rounded-md bg-rose-50 text-rose-700" : "grid size-9 place-items-center rounded-md bg-emerald-50 text-emerald-700"}>
                  {movement.type === "out" ? <ArrowDown className="size-4" /> : <ArrowUp className="size-4" />}
                </span>
                <div>
                  <p className="text-sm font-semibold">{movement.materialName}</p>
                  <p className="mt-0.5 text-xs text-stone-500">{movement.notes}</p>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-sm font-semibold">{movement.type === "out" ? "-" : movement.type === "in" ? "+" : "="}{movement.quantity}</p>
                <p className="text-xs text-stone-500">{new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(movement.createdAt))}</p>
              </div>
            </div>
          ))}
          {!movements.length ? <p className="p-6 text-sm text-stone-500">Aún no hay movimientos registrados.</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
