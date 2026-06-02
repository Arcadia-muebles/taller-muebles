import { Boxes, Plus, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { listStockItems } from "@/lib/repositories/production";

export default async function StockPage() {
  const items = await listStockItems();
  const critical = items.filter((item) => item.available <= item.minimum);

  return (
    <AppShell active="admin" user={{ name: "Rodrigo", role: "Administrador" }}>
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
        <button className="inline-flex h-10 items-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-medium text-white">
          <Plus className="size-4" />
          Nuevo material
        </button>
      </header>

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
                <th className="px-4 py-3">Disponible</th>
                <th className="px-4 py-3">Minimo</th>
                <th className="px-4 py-3">Ubicacion</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-stone-100">
                  <td className="px-4 py-3 text-sm font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-sm text-stone-600">{item.category}</td>
                  <td className="px-4 py-3 text-sm font-semibold">
                    {item.available} {item.unit}
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-600">
                    {item.minimum} {item.unit}
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-600">{item.store}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
