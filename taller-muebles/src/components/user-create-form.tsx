"use client";

import { CheckCircle2, Plus, XCircle } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { createUser, type UserActionResult } from "@/app/admin/users/actions";
import { SubmitButton } from "./submit-button";

const initialState: UserActionResult = { ok: false, message: "" };
const inputClass = "h-10 w-full rounded-md border border-stone-200 bg-stone-50 px-3 text-sm text-stone-950 outline-none transition focus:border-stone-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-50";

export function UserCreateForm({ supabaseEnabled, disabled }: { supabaseEnabled: boolean; disabled: boolean }) {
  const [role, setRole] = useState("operator");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(async (_state: UserActionResult, formData: FormData) => {
    const result = await createUser(formData);
    if (result.ok) {
      formRef.current?.reset();
      setRole("operator");
    }
    return result;
  }, initialState);

  return (
    <form ref={formRef} action={action} className="mt-5 rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="text-base font-semibold">Registrar usuario</h2>
      <p className="mt-1 text-sm text-stone-500">
        {supabaseEnabled ? "Crea una cuenta protegida y asigna su acceso inicial." : "Crea un perfil para probar roles en modo local."}
      </p>
      {disabled ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Agrega `SUPABASE_SERVICE_ROLE_KEY` para administrar cuentas desde esta pantalla.
        </p>
      ) : null}
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Field label="Nombre" className="xl:col-span-2">
          <input disabled={disabled} name="name" required placeholder="Nombre completo" className={inputClass} />
        </Field>
        <Field label="Correo" className="xl:col-span-2">
          <input disabled={disabled} name="email" required type="email" placeholder="correo@empresa.cl" className={inputClass} />
        </Field>
        <Field label="Rol">
          <select disabled={disabled} name="role" value={role} onChange={(event) => setRole(event.target.value)} className={inputClass}>
            <option value="admin">Administrador</option>
            <option value="manager">Encargado</option>
            <option value="operator">Trabajador</option>
            <option value="viewer">Lectura</option>
          </select>
        </Field>
        <Field label="Área">
          <select disabled={disabled || role !== "operator"} name="area" defaultValue="" className={inputClass}>
            <option value="">Todas las etapas</option>
            <option value="structure">Estructura</option>
            <option value="cutting">Corte</option>
            <option value="sewing">Costura</option>
            <option value="upholstery">Tapicería</option>
            <option value="quality">Revisión</option>
          </select>
        </Field>
        {supabaseEnabled ? (
          <Field label="Clave temporal" className="xl:col-span-2">
            <input disabled={disabled} name="password" required minLength={8} type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" className={inputClass} />
          </Field>
        ) : null}
        <div className={supabaseEnabled ? "flex flex-col justify-end gap-2 xl:col-span-4" : "flex flex-col justify-end gap-2 xl:col-span-5"}>
          <ActionFeedback state={state} supabaseEnabled={supabaseEnabled} disabled={disabled} />
        </div>
        <div className="flex items-end">
          <SubmitButton disabled={disabled} pendingLabel="Creando..." className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-stone-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">
            <Plus className="size-4" />
            Crear usuario
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`grid gap-1.5 text-xs font-medium text-stone-600 ${className ?? ""}`}>{label}{children}</label>;
}

function ActionFeedback({
  state,
  supabaseEnabled,
  disabled,
}: {
  state: UserActionResult;
  supabaseEnabled: boolean;
  disabled: boolean;
}) {
  if (state.message) {
    const Icon = state.ok ? CheckCircle2 : XCircle;
    return (
      <p role="status" className={`inline-flex items-center gap-1.5 text-xs font-medium ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>
        <Icon className="size-3.5" />
        {state.message}
      </p>
    );
  }

  if (disabled) {
    return <p className="text-xs text-amber-700">La administración de cuentas requiere la clave de servicio.</p>;
  }

  return (
    <p className="text-xs text-stone-400">
      {supabaseEnabled
        ? "La cuenta se crea confirmada y con perfil operativo asignado."
        : "El perfil local queda disponible inmediatamente para probar permisos."}
    </p>
  );
}
