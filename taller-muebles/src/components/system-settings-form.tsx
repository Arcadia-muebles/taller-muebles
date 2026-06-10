"use client";

import {
  BellRing,
  Check,
  ClipboardList,
  Clock3,
  Factory,
  LockKeyhole,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useState, useTransition } from "react";
import { saveSystemSettings } from "@/app/admin/settings/actions";
import { defaultSystemSettings } from "@/lib/system-settings";
import type { SystemSettings } from "@/lib/types";

type SectionKey = "general" | "production" | "orders" | "alerts" | "permissions";

const sections = [
  { key: "general", label: "Operacion general", description: "Jornada e identidad", icon: Settings2 },
  { key: "production", label: "Flujo productivo", description: "Etapas y tiempos objetivo", icon: Factory },
  { key: "orders", label: "Notas de venta", description: "Validaciones y cierre", icon: ClipboardList },
  { key: "alerts", label: "Alertas", description: "Umbrales y resumen diario", icon: BellRing },
  { key: "permissions", label: "Permisos operativos", description: "Acciones por perfil", icon: ShieldCheck },
] as const;

const dayOptions = [
  [1, "Lun"], [2, "Mar"], [3, "Mie"], [4, "Jue"], [5, "Vie"], [6, "Sab"], [0, "Dom"],
] as const;

export function SystemSettingsForm({
  initialSettings,
  canEdit,
}: {
  initialSettings: SystemSettings;
  canEdit: boolean;
}) {
  const [active, setActive] = useState<SectionKey>("general");
  const [settings, setSettings] = useState(initialSettings);
  const [savedSettings, setSavedSettings] = useState(initialSettings);
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();
  const dirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  function save() {
    setFeedback("");
    startTransition(async () => {
      try {
        const result = await saveSystemSettings(settings);
        setFeedback(result.message);
        if (result.ok) setSavedSettings(settings);
      } catch {
        setFeedback("No fue posible guardar los cambios. Intenta nuevamente.");
      }
    });
  }

  function restoreDefaults() {
    setSettings(structuredClone(defaultSystemSettings));
    setFeedback("Valores por defecto cargados. Guarda para aplicarlos.");
  }

  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="panel self-start p-2 xl:sticky xl:top-5">
        <div className="border-b border-stone-100 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-400">Categorias</p>
          <p className="mt-1 text-sm text-stone-600">Define como opera la plataforma.</p>
        </div>
        <nav className="mt-2 space-y-1" aria-label="Secciones de configuracion">
          {sections.map((section) => {
            const Icon = section.icon;
            const selected = active === section.key;
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setActive(section.key)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${selected ? "bg-stone-950 text-white" : "text-stone-700 hover:bg-stone-100"}`}
              >
                <Icon className={`size-4 shrink-0 ${selected ? "text-white" : "text-stone-500"}`} />
                <span>
                  <span className="block text-sm font-medium">{section.label}</span>
                  <span className={`mt-0.5 block text-xs ${selected ? "text-stone-300" : "text-stone-400"}`}>{section.description}</span>
                </span>
              </button>
            );
          })}
        </nav>
        <div className="mt-2 border-t border-stone-100 p-3">
          <div className="flex items-start gap-2 text-xs leading-5 text-stone-500">
            <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
            Solo administradores pueden modificar estas reglas.
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {!canEdit ? (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <LockKeyhole className="size-4 shrink-0" />
            Estas reglas estan disponibles en modo lectura para tu perfil.
          </div>
        ) : null}

        <section className="panel">
          <SectionHeader section={active} />
          <div className="p-5 sm:p-6">
            {active === "general" ? <GeneralSection settings={settings} setSettings={setSettings} disabled={!canEdit} /> : null}
            {active === "production" ? <ProductionSection settings={settings} setSettings={setSettings} disabled={!canEdit} /> : null}
            {active === "orders" ? <OrdersSection settings={settings} setSettings={setSettings} disabled={!canEdit} /> : null}
            {active === "alerts" ? <AlertsSection settings={settings} setSettings={setSettings} disabled={!canEdit} /> : null}
            {active === "permissions" ? <PermissionsSection settings={settings} setSettings={setSettings} disabled={!canEdit} /> : null}
          </div>
        </section>

        {canEdit ? (
          <div className="sticky bottom-3 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white/95 p-3 shadow-lg shadow-stone-950/5 backdrop-blur">
            <div className="px-1">
              <p className="text-sm font-medium text-stone-800">{dirty ? "Hay cambios sin guardar" : "Configuracion al dia"}</p>
              <p className="mt-0.5 text-xs text-stone-500">{feedback || "Los cambios se aplican despues de guardar."}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={restoreDefaults} className="btn btn-secondary">
                <RotateCcw className="size-4" />
                Restaurar
              </button>
              <button type="button" onClick={save} disabled={!dirty || isPending} className="btn btn-primary px-4">
                {dirty ? <Save className="size-4" /> : <Check className="size-4" />}
                {isPending ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SectionHeader({ section }: { section: SectionKey }) {
  const current = sections.find((item) => item.key === section)!;
  const Icon = current.icon;
  return (
    <header className="flex items-start gap-3 border-b border-stone-200 p-5 sm:p-6">
      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-700"><Icon className="size-5" /></div>
      <div>
        <h2 className="text-lg font-semibold">{current.label}</h2>
        <p className="mt-1 text-sm text-stone-500">{sectionCopy[section]}</p>
      </div>
    </header>
  );
}

const sectionCopy: Record<SectionKey, string> = {
  general: "Configura el nombre visible, zona horaria y dias efectivos de trabajo.",
  production: "Ajusta nombres, disponibilidad y tiempos esperados de cada etapa.",
  orders: "Controla la calidad minima de los datos y el tratamiento de ordenes terminadas.",
  alerts: "Define cuando una situacion requiere atencion del equipo.",
  permissions: "Limita las acciones sensibles de supervisores y trabajadores.",
};

function GeneralSection({ settings, setSettings, disabled }: SectionProps) {
  const update = (patch: Partial<SystemSettings["general"]>) => setSettings({ ...settings, general: { ...settings.general, ...patch } });
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre visible del sistema" hint="Aparece en encabezados y reportes.">
          <input disabled={disabled} value={settings.general.businessName} onChange={(event) => update({ businessName: event.target.value })} className={inputClass} />
        </Field>
        <Field label="Zona horaria" hint="Usada para alertas, fechas y auditoria.">
          <select disabled={disabled} value={settings.general.timezone} onChange={(event) => update({ timezone: event.target.value })} className={inputClass}>
            <option value="America/Santiago">America/Santiago</option>
            <option value="America/Bogota">America/Bogota</option>
            <option value="America/Lima">America/Lima</option>
          </select>
        </Field>
        <Field label="Inicio de jornada"><input disabled={disabled} type="time" value={settings.general.workdayStart} onChange={(event) => update({ workdayStart: event.target.value })} className={inputClass} /></Field>
        <Field label="Fin de jornada"><input disabled={disabled} type="time" value={settings.general.workdayEnd} onChange={(event) => update({ workdayEnd: event.target.value })} className={inputClass} /></Field>
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800">Dias laborales</p>
        <p className="mt-1 text-xs text-stone-500">Se usan para calcular plazos productivos.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {dayOptions.map(([value, label]) => {
            const selected = settings.general.workdays.includes(value);
            return <button disabled={disabled} key={value} type="button" onClick={() => update({ workdays: selected ? settings.general.workdays.filter((day) => day !== value) : [...settings.general.workdays, value] })} className={`h-10 min-w-14 rounded-md border px-3 text-sm font-medium ${selected ? "border-stone-950 bg-stone-950 text-white" : "border-stone-200 bg-white text-stone-600"}`}>{label}</button>;
          })}
        </div>
      </div>
    </div>
  );
}

function ProductionSection({ settings, setSettings, disabled }: SectionProps) {
  const updateProduction = (patch: Partial<SystemSettings["production"]>) => setSettings({ ...settings, production: { ...settings.production, ...patch } });
  const updateStep = (index: number, patch: Partial<SystemSettings["production"]["steps"][number]>) => {
    const nextSteps = settings.production.steps.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item);
    updateProduction({
      steps: nextSteps,
      ...qualityDependentPatch(nextSteps, settings.production),
    });
  };
  const addStep = () => {
    const key = uniqueStepKey(settings.production.steps.map((step) => step.key), "nueva_etapa");
    updateProduction({
      steps: [
        ...settings.production.steps,
        { key, label: "Nueva etapa", targetDays: 1, enabled: true, required: false },
      ],
    });
  };
  const removeStep = (index: number) => {
    if (settings.production.steps.length <= 1) return;
    const nextSteps = settings.production.steps.filter((_, itemIndex) => itemIndex !== index);
    updateProduction({ steps: nextSteps, ...qualityDependentPatch(nextSteps, settings.production) });
  };
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-lg border border-stone-200">
        <div className="hidden grid-cols-[minmax(0,1fr)_120px_90px_90px_44px] gap-3 bg-stone-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-stone-400 sm:grid">
          <span>Etapa</span><span>Plazo objetivo</span><span>Activa</span><span>Obligatoria</span><span />
        </div>
        {settings.production.steps.map((step, index) => (
          <div key={step.key} className="grid gap-3 border-t border-stone-100 p-4 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_120px_90px_90px_44px] sm:items-center">
            <div>
              <input
                disabled={disabled}
                value={step.label}
                onChange={(event) => updateStep(index, { label: event.target.value })}
                className={inputClass}
              />
              <p className="mt-1 font-mono text-[11px] text-stone-400">{step.key}</p>
            </div>
            <label className="relative"><input disabled={disabled} type="number" min="0" max="90" value={step.targetDays} onChange={(event) => updateStep(index, { targetDays: Number(event.target.value) })} className={`${inputClass} pr-10`} /><span className="absolute right-3 top-3 text-xs text-stone-400">dias</span></label>
            <Toggle compact disabled={disabled} checked={step.enabled} onChange={(checked) => updateStep(index, { enabled: checked, required: checked ? step.required : false })} />
            <Toggle compact disabled={disabled || !step.enabled} checked={step.required} onChange={(checked) => updateStep(index, { required: checked })} />
            <button
              type="button"
              disabled={disabled || settings.production.steps.length <= 1}
              onClick={() => removeStep(index)}
              aria-label={`Eliminar etapa ${step.label}`}
              className="grid size-10 place-items-center rounded-md border border-stone-200 text-stone-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled || settings.production.steps.length >= 20}
        onClick={addStep}
        className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="size-4" />
        Agregar etapa
      </button>
      <div className="grid gap-3">
        <RuleRow title="Permitir etapas en paralelo" description="Una orden puede tener mas de una etapa activa al mismo tiempo." checked={settings.production.allowParallelSteps} disabled={disabled} onChange={(value) => updateProduction({ allowParallelSteps: value })} />
        <RuleRow title="Exigir aprobacion de calidad" description="Evita cerrar una orden sin completar la revision final." checked={settings.production.requireQualityApproval} disabled={disabled} onChange={(value) => updateProduction({ requireQualityApproval: value })} />
        <RuleRow title="Cerrar automaticamente tras calidad" description="Marca la orden como terminada al aprobar la etapa de revision." checked={settings.production.autoCompleteAfterQuality} disabled={disabled} onChange={(value) => updateProduction({ autoCompleteAfterQuality: value })} />
      </div>
    </div>
  );
}

function OrdersSection({ settings, setSettings, disabled }: SectionProps) {
  const update = (patch: Partial<SystemSettings["orders"]>) => setSettings({ ...settings, orders: { ...settings.orders, ...patch } });
  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Prioridad por defecto"><select disabled={disabled} value={settings.orders.defaultPriority} onChange={(event) => update({ defaultPriority: event.target.value as SystemSettings["orders"]["defaultPriority"] })} className={inputClass}><option value="normal">Normal</option><option value="high">Alta</option><option value="critical">Critica</option></select></Field>
      <Field label="Archivar terminadas despues de" hint="Usa 0 para archivar inmediatamente."><NumberInput disabled={disabled} value={settings.orders.archiveCompletedAfterDays} suffix="dias" onChange={(value) => update({ archiveCompletedAfterDays: value })} /></Field>
    </div>
    <div className="grid gap-3">
      <RuleRow title="Exigir responsable asignado" description="No permite crear ordenes sin una persona responsable." checked={settings.orders.requireAssignedPerson} disabled={disabled} onChange={(value) => update({ requireAssignedPerson: value })} />
      <RuleRow title="Exigir material y color" description="Mantiene la ficha productiva completa desde el ingreso." checked={settings.orders.requireMaterialAndColor} disabled={disabled} onChange={(value) => update({ requireMaterialAndColor: value })} />
      <RuleRow title="Exigir observaciones en garantias" description="Obliga a documentar el motivo y alcance del trabajo." checked={settings.orders.requireObservationsForWarranty} disabled={disabled} onChange={(value) => update({ requireObservationsForWarranty: value })} />
      <RuleRow title="Numero de nota de venta unico" description="Previene el ingreso duplicado de una misma venta." checked={settings.orders.enforceUniqueSalesNote} disabled={disabled} onChange={(value) => update({ enforceUniqueSalesNote: value })} />
      <RuleRow title="Permitir fechas de entrega pasadas" description="Habilita carga historica con fechas anteriores a hoy." checked={settings.orders.allowPastDeliveryDates} disabled={disabled} onChange={(value) => update({ allowPastDeliveryDates: value })} />
    </div>
  </div>;
}

function AlertsSection({ settings, setSettings, disabled }: SectionProps) {
  const update = (patch: Partial<SystemSettings["alerts"]>) => setSettings({ ...settings, alerts: { ...settings.alerts, ...patch } });
  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-3">
      <Field label="Entrega proxima"><NumberInput disabled={disabled} value={settings.alerts.upcomingDeliveryDays} suffix="dias" onChange={(value) => update({ upcomingDeliveryDays: value })} /></Field>
      <Field label="Entrega urgente"><NumberInput disabled={disabled} value={settings.alerts.urgentDeliveryDays} suffix="dias" onChange={(value) => update({ urgentDeliveryDays: value })} /></Field>
      <Field label="Bloqueo prolongado"><NumberInput disabled={disabled} value={settings.alerts.blockedAfterHours} suffix="horas" onChange={(value) => update({ blockedAfterHours: value })} /></Field>
    </div>
    <div className="grid gap-3">
      <RuleRow title="Alertas de stock bajo" description="Destaca materiales bajo su minimo configurado." checked={settings.alerts.stockAlertsEnabled} disabled={disabled} onChange={(value) => update({ stockAlertsEnabled: value })} />
      <RuleRow title="Alertas de entrega" description="Muestra entregas proximas, urgentes y atrasadas." checked={settings.alerts.deliveryAlertsEnabled} disabled={disabled} onChange={(value) => update({ deliveryAlertsEnabled: value })} />
      <RuleRow title="Alertas de bloqueos" description="Destaca etapas bloqueadas que requieren intervencion." checked={settings.alerts.blockedAlertsEnabled} disabled={disabled} onChange={(value) => update({ blockedAlertsEnabled: value })} />
      <RuleRow title="Resumen diario" description="Prepara un resumen operativo al inicio de la jornada." checked={settings.alerts.dailySummaryEnabled} disabled={disabled} onChange={(value) => update({ dailySummaryEnabled: value })}>
        <input disabled={disabled || !settings.alerts.dailySummaryEnabled} type="time" value={settings.alerts.dailySummaryTime} onChange={(event) => update({ dailySummaryTime: event.target.value })} className="h-9 rounded-md border border-stone-200 bg-white px-2 text-sm disabled:opacity-40" />
      </RuleRow>
    </div>
  </div>;
}

function PermissionsSection({ settings, setSettings, disabled }: SectionProps) {
  const update = (patch: Partial<SystemSettings["permissions"]>) => setSettings({ ...settings, permissions: { ...settings.permissions, ...patch } });
  return <div className="space-y-6">
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-700">Los administradores conservan acceso total. Estas reglas controlan las acciones disponibles para supervisores y trabajadores.</div>
    <div>
      <GroupLabel title="Supervisores" />
      <div className="mt-3 grid gap-3">
        <RuleRow title="Editar notas de venta" description="Pueden modificar datos comerciales y productivos." checked={settings.permissions.managersCanEditOrders} disabled={disabled} onChange={(value) => update({ managersCanEditOrders: value })} />
        <RuleRow title="Gestionar stock" description="Pueden crear materiales y registrar movimientos." checked={settings.permissions.managersCanManageStock} disabled={disabled} onChange={(value) => update({ managersCanManageStock: value })} />
      </div>
    </div>
    <div>
      <GroupLabel title="Trabajadores de taller" />
      <div className="mt-3 grid gap-3">
        <RuleRow title="Iniciar etapas" description="Pueden marcar una etapa pendiente como activa." checked={settings.permissions.operatorsCanStartSteps} disabled={disabled} onChange={(value) => update({ operatorsCanStartSteps: value })} />
        <RuleRow title="Completar etapas" description="Pueden marcar su trabajo como terminado." checked={settings.permissions.operatorsCanCompleteSteps} disabled={disabled} onChange={(value) => update({ operatorsCanCompleteSteps: value })} />
        <RuleRow title="Bloquear etapas" description="Pueden informar impedimentos desde la cola de taller." checked={settings.permissions.operatorsCanBlockSteps} disabled={disabled} onChange={(value) => update({ operatorsCanBlockSteps: value })} />
        <RuleRow title="Exigir motivo de bloqueo" description="Obliga a registrar una explicacion antes de bloquear." checked={settings.permissions.requireBlockReason} disabled={disabled || !settings.permissions.operatorsCanBlockSteps} onChange={(value) => update({ requireBlockReason: value })} />
      </div>
    </div>
  </div>;
}

type SectionProps = { settings: SystemSettings; setSettings: (settings: SystemSettings) => void; disabled: boolean };
const inputClass = "control-lg text-stone-800 disabled:cursor-not-allowed disabled:opacity-60";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-sm font-medium text-stone-800">{label}</span>{hint ? <span className="mt-1 block text-xs text-stone-500">{hint}</span> : null}<span className="mt-2 block">{children}</span></label>;
}

function NumberInput({ value, suffix, onChange, disabled }: { value: number; suffix: string; onChange: (value: number) => void; disabled: boolean }) {
  return <label className="relative block"><input disabled={disabled} type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value))} className={`${inputClass} pr-14`} /><span className="absolute right-3 top-3.5 text-xs text-stone-400">{suffix}</span></label>;
}

function RuleRow({ title, description, checked, onChange, disabled, children }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void; disabled: boolean; children?: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-stone-200 p-4"><div className="min-w-0 flex-1"><p className="text-sm font-medium text-stone-800">{title}</p><p className="mt-1 text-xs leading-5 text-stone-500">{description}</p></div>{children}<Toggle checked={checked} onChange={onChange} disabled={disabled} /></div>;
}

function Toggle({ checked, onChange, disabled, compact = false }: { checked: boolean; onChange: (checked: boolean) => void; disabled: boolean; compact?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${checked ? "bg-stone-950" : "bg-stone-200"} ${compact ? "sm:justify-self-start" : ""}`}><span className={`absolute top-1 size-4 rounded-full bg-white shadow-sm transition ${checked ? "left-6" : "left-1"}`} /></button>;
}

function GroupLabel({ title }: { title: string }) {
  return <div className="flex items-center gap-2"><Clock3 className="size-4 text-stone-400" /><p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">{title}</p></div>;
}

function slugifyStepKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

function uniqueStepKey(existing: string[], base: string) {
  const cleanBase = slugifyStepKey(base) || "etapa";
  const used = new Set(existing);
  if (!used.has(cleanBase)) return cleanBase;
  for (let index = 2; index <= 99; index += 1) {
    const candidate = `${cleanBase}_${index}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${cleanBase}_${Date.now().toString(36)}`;
}

function qualityDependentPatch(
  steps: SystemSettings["production"]["steps"],
  production: SystemSettings["production"],
): Partial<SystemSettings["production"]> {
  const qualityEnabled = steps.some((step) => step.key === "quality" && step.enabled);
  if (qualityEnabled) return {};
  if (!production.requireQualityApproval && !production.autoCompleteAfterQuality) return {};
  return {
    requireQualityApproval: false,
    autoCompleteAfterQuality: false,
  };
}
