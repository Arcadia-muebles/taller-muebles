import { Settings } from "lucide-react";
import { AppShell } from "@/components/app-shell";

const settings = [
  ["Etapas productivas", "Estructura, corte, costura, tapiceria y revision."],
  ["Estados", "Programada, en produccion, urgente, bloqueada, revision, terminada."],
  ["Tiendas", "Leather House y La Reina."],
  ["Alertas", "Atrasos, bloqueos, stock bajo y entregas cercanas."],
];

export default function SettingsPage() {
  return (
    <AppShell active="admin" user={{ name: "Rodrigo", role: "Administrador" }}>
      <header className="border-b border-stone-200 pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
          Configuracion
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Reglas del sistema</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          Parametros que deben validarse con Rodrigo antes de cerrar la primera version productiva.
        </p>
      </header>

      <section className="mt-5 grid gap-3 md:grid-cols-2">
        {settings.map(([title, copy]) => (
          <article key={title} className="rounded-lg border border-stone-200 bg-white p-4">
            <Settings className="size-5 text-stone-500" />
            <p className="mt-4 text-sm font-semibold">{title}</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">{copy}</p>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
