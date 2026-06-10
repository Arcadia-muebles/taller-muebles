"use client";

import { CheckCircle2, Save, XCircle } from "lucide-react";
import { useActionState, useState } from "react";
import { updateUser, type UserActionResult } from "@/app/admin/users/actions";
import type { AppUser, SystemSettings } from "@/lib/types";
import { SubmitButton } from "./submit-button";

const initialState: UserActionResult = { ok: false, message: "" };
const inputClass = "control disabled:cursor-not-allowed disabled:opacity-50";

export function UserEditForm({
  user,
  steps,
  disabled,
}: {
  user: AppUser;
  steps: SystemSettings["production"]["steps"];
  disabled: boolean;
}) {
  const [role, setRole] = useState(user.role);
  const [state, action] = useActionState(async (_state: UserActionResult, formData: FormData) => {
    return updateUser(formData);
  }, initialState);
  const enabledSteps = steps.filter((step) => step.enabled);
  const selectedAreas = user.areas?.length ? user.areas : user.area ? [user.area] : [];

  return (
    <form action={action} className="grid gap-3 border-t border-stone-100 p-4 md:grid-cols-[minmax(0,1.2fr)_160px_120px_auto] md:items-end">
      <input type="hidden" name="userId" value={user.id} />
      <Field label="Nombre">
        <input name="name" defaultValue={user.name} disabled={disabled} required className={inputClass} />
      </Field>
      <Field label="Rol">
        <select name="role" value={role} disabled={disabled} onChange={(event) => setRole(event.target.value as AppUser["role"])} className={inputClass}>
          <option value="admin">Administrador</option>
          <option value="manager">Supervisor</option>
          <option value="operator">Trabajador</option>
          <option value="viewer">Lectura</option>
        </select>
      </Field>
      <Field label="Estado">
        <select name="active" defaultValue={String(user.active)} disabled={disabled} className={inputClass}>
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </select>
      </Field>
      <div className="flex flex-col gap-2">
        <SubmitButton disabled={disabled} pendingLabel="Guardando..." className="btn btn-secondary">
          <Save className="size-4" />
          Guardar
        </SubmitButton>
        <ActionFeedback state={state} />
      </div>
      {role === "operator" ? (
        <fieldset className="md:col-span-4">
          <legend className="text-xs font-medium text-stone-600">Procesos habilitados</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {enabledSteps.map((step) => (
              <label key={step.key} className="inline-flex h-9 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700">
                <input
                  type="checkbox"
                  name="areas"
                  value={step.key}
                  defaultChecked={selectedAreas.includes(step.key)}
                  disabled={disabled}
                  className="size-4 accent-stone-950"
                />
                {step.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-medium text-stone-600">{label}{children}</label>;
}

function ActionFeedback({ state }: { state: UserActionResult }) {
  if (!state.message) return <span className="min-h-4 text-[11px] text-stone-400"> </span>;
  const Icon = state.ok ? CheckCircle2 : XCircle;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>
      <Icon className="size-3" />
      {state.message}
    </span>
  );
}
