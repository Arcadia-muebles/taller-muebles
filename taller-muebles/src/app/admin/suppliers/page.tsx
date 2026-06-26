import { Building2, Plus, Save, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { deactivateSupplier, saveSupplier } from "@/app/admin/suppliers/actions";
import { requireSession } from "@/lib/auth";
import { listSuppliers } from "@/lib/repositories/production";
import { getSystemSettings } from "@/lib/repositories/settings";
import type { Supplier } from "@/lib/types";

export default async function SuppliersPage() {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const [suppliers, settings] = await Promise.all([listSuppliers(), getSystemSettings()]);
  const canEdit = user.role === "admin" || (user.role === "manager" && settings.permissions.managersCanManageStock);
  const activeSuppliers = suppliers.filter((supplier) => supplier.active);

  return (
    <AppShell active="admin" user={user}>
      <header className="page-header">
        <div>
          <p className="page-kicker">Proveedores</p>
          <h1 className="page-title">Registro de proveedores</h1>
          <p className="page-description">
            Contactos, productos y observaciones de proveedores importantes para compras y producción.
          </p>
        </div>
      </header>

      {canEdit ? <SupplierForm /> : null}

      <section className="panel mt-5">
        <div className="panel-header flex items-center gap-3">
          <Building2 className="size-5 text-stone-500" />
          <div>
            <h2 className="panel-title">Proveedores activos</h2>
            <p className="panel-description">{activeSuppliers.length} proveedores registrados.</p>
          </div>
        </div>
        <div className="grid gap-3 p-3 xl:grid-cols-2">
          {activeSuppliers.map((supplier) => (
            <SupplierCard key={supplier.id} supplier={supplier} canEdit={canEdit} />
          ))}
          {!activeSuppliers.length ? (
            <div className="empty-state xl:col-span-2">No hay proveedores activos.</div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}

function SupplierForm({ supplier }: { supplier?: Supplier }) {
  return (
    <form action={saveSupplier} className={supplier ? "rounded-md border border-stone-200 bg-stone-50 p-3" : "panel mt-5"}>
      {supplier ? <input type="hidden" name="id" value={supplier.id} /> : null}
      {!supplier ? (
        <div className="panel-header flex items-center gap-3">
          <Plus className="size-5 text-stone-500" />
          <div>
            <h2 className="panel-title">Nuevo proveedor</h2>
            <p className="panel-description">Registro simple para encontrar datos de contacto y productos.</p>
          </div>
        </div>
      ) : null}
      <div className="grid gap-3 p-3 md:grid-cols-2">
        <Field label="Nombre">
          <input name="name" required defaultValue={supplier?.name} className="control bg-white" />
        </Field>
        <Field label="Contacto">
          <input name="contactName" defaultValue={supplier?.contactName} className="control bg-white" />
        </Field>
        <Field label="Teléfono">
          <input name="phone" defaultValue={supplier?.phone} className="control bg-white" />
        </Field>
        <Field label="Correo">
          <input name="email" type="email" defaultValue={supplier?.email} className="control bg-white" />
        </Field>
        <Field label="Dirección" full>
          <input name="address" defaultValue={supplier?.address} className="control bg-white" />
        </Field>
        <Field label="Productos o servicios" full>
          <textarea name="products" required defaultValue={supplier?.products} className="textarea-control min-h-20 bg-white" placeholder="Maderas, telas, espuma, herrajes..." />
        </Field>
        <Field label="Observaciones" full>
          <textarea name="observations" defaultValue={supplier?.observations} className="textarea-control min-h-20 bg-white" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-stone-200 p-3">
        <button type="submit" className="btn btn-primary h-9">
          <Save className="size-4" />
          {supplier ? "Guardar" : "Crear proveedor"}
        </button>
      </div>
    </form>
  );
}

function SupplierCard({ supplier, canEdit }: { supplier: Supplier; canEdit: boolean }) {
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-stone-950">{supplier.name}</h3>
          <p className="mt-1 text-sm text-stone-500">{supplier.contactName || "Sin contacto registrado"}</p>
        </div>
        {canEdit ? (
          <form action={deactivateSupplier}>
            <input type="hidden" name="id" value={supplier.id} />
            <button type="submit" className="grid size-8 place-items-center rounded-md text-stone-400 hover:bg-rose-50 hover:text-rose-700" title="Desactivar proveedor" aria-label="Desactivar proveedor">
              <Trash2 className="size-4" />
            </button>
          </form>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <Info label="Teléfono" value={supplier.phone} />
        <Info label="Correo" value={supplier.email} />
        <Info label="Dirección" value={supplier.address} />
        <Info label="Productos" value={supplier.products} />
      </div>
      {supplier.observations ? <p className="mt-3 rounded-md border border-stone-200 bg-stone-50 p-3 text-sm leading-6 text-stone-700">{supplier.observations}</p> : null}
      {canEdit ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-stone-600 hover:text-stone-950">Editar datos</summary>
          <div className="mt-3">
            <SupplierForm supplier={supplier} />
          </div>
        </details>
      ) : null}
    </article>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={full ? "md:col-span-2" : undefined}>
      <span className="field-label">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-stone-200 bg-stone-50 p-2">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-stone-800">{value?.trim() || "Sin registrar"}</p>
    </div>
  );
}
