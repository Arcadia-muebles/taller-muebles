"use client";

import { ChevronDown, Pencil, Plus, ShieldCheck, UserRound } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { createUser, type UserActionResult } from "@/app/admin/users/actions";
import type { AppUser, Role, SystemSettings } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DeactivateUserButton } from "./deactivate-user-button";
import { SubmitButton } from "./submit-button";
import { UserEditForm } from "./user-edit-form";

const roleOrder: Role[] = ["admin", "manager", "operator", "viewer"];
const initialState: UserActionResult = { ok: false, message: "" };
const inputClass = "control disabled:cursor-not-allowed disabled:opacity-50";

export function RoleUserGroups({
  users,
  steps,
  supabaseEnabled,
  disabled,
}: {
  users: AppUser[];
  steps: SystemSettings["production"]["steps"];
  supabaseEnabled: boolean;
  disabled: boolean;
}) {
  const [openRoles, setOpenRoles] = useState<Record<Role, boolean>>({
    admin: false,
    manager: false,
    operator: false,
    viewer: false,
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const enabledSteps = steps.filter((step) => step.enabled);

  return (
    <section className="mt-5 space-y-3">
      {roleOrder.map((role) => {
        const roleUsers = users.filter((user) => user.role === role);
        const open = openRoles[role];
        return (
          <div key={role} className="panel overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenRoles((current) => ({ ...current, [role]: !current[role] }))}
              className="flex w-full items-center justify-between gap-4 border-b border-stone-200 px-4 py-4 text-left"
            >
              <span className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg border border-stone-200 bg-white">
                  <ShieldCheck className="size-5 text-stone-600" />
                </span>
                <span>
                  <span className="block text-base font-semibold text-stone-950">{roleLabel(role)}</span>
                  <span className="mt-0.5 block text-sm text-stone-500">
                    {roleUsers.filter((user) => user.active).length} activos · {roleUsers.length} registrados
                  </span>
                </span>
              </span>
              <ChevronDown className={cn("size-5 shrink-0 text-stone-500 transition", open ? "rotate-180" : "")} />
            </button>

            {open ? (
              <div>
                <RoleCreateForm
                  role={role}
                  steps={steps}
                  supabaseEnabled={supabaseEnabled}
                  disabled={disabled}
                />
                <div>
                  {roleUsers.map((user) => (
                    <article key={user.id} className="border-t border-stone-100">
                      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`grid size-10 place-items-center rounded-lg ${user.active ? "bg-stone-100" : "bg-stone-50 opacity-50"}`}>
                            <UserRound className="size-5 text-stone-600" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">{user.name}</p>
                              {!user.active ? <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">Inactivo</span> : null}
                            </div>
                            <p className="text-sm text-stone-500">
                              {user.email.includes("@") ? user.email : "Cuenta Supabase"}
                              {userAreas(user).length ? ` · ${areaLabels(userAreas(user), enabledSteps)}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex h-8 items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 text-xs font-medium">
                            <ShieldCheck className="size-3.5" />
                            {roleLabel(user.role)}
                          </span>
                          <button
                            type="button"
                            title="Editar usuario"
                            disabled={disabled}
                            onClick={() => setEditingUserId((current) => current === user.id ? null : user.id)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Pencil className="size-3.5" />
                            {editingUserId === user.id ? "Cerrar" : "Editar"}
                          </button>
                        </div>
                      </div>
                      {editingUserId === user.id ? (
                        <div className="border-t border-stone-100 bg-stone-50/60">
                          <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-stone-950">Editar perfil</p>
                              <p className="text-xs text-stone-500">Modifica sus datos, permisos o elimina su acceso.</p>
                            </div>
                            <DeactivateUserButton userId={user.id} disabled={disabled} />
                          </div>
                          <UserEditForm
                            user={user}
                            steps={steps}
                            supabaseEnabled={supabaseEnabled}
                            disabled={disabled}
                          />
                        </div>
                      ) : null}
                    </article>
                  ))}
                  {!roleUsers.length ? (
                    <div className="border-t border-stone-100 p-4 text-sm text-stone-500">
                      No hay usuarios registrados en este rol.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

function RoleCreateForm({
  role,
  steps,
  supabaseEnabled,
  disabled,
}: {
  role: Role;
  steps: SystemSettings["production"]["steps"];
  supabaseEnabled: boolean;
  disabled: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const enabledSteps = steps.filter((step) => step.enabled);
  const [state, action] = useActionState(async (_state: UserActionResult, formData: FormData) => {
    const result = await createUser(formData);
    if (result.ok) formRef.current?.reset();
    return result;
  }, initialState);

  return (
    <form ref={formRef} action={action} className="grid gap-3 bg-stone-50 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto] md:items-end">
      <input type="hidden" name="role" value={role} />
      <Field label="Nombre">
        <input disabled={disabled} name="name" required placeholder="Nombre completo" className={inputClass} />
      </Field>
      <Field label="Correo">
        <input disabled={disabled} name="email" required type="email" placeholder="correo@empresa.cl" className={inputClass} />
      </Field>
      {role === "operator" ? (
        <StepCheckboxes steps={enabledSteps} disabled={disabled} />
      ) : (
        <input type="hidden" name="areas" value="" />
      )}
      {supabaseEnabled ? (
        <Field label="Clave temporal">
          <input disabled={disabled} name="password" required minLength={8} type="password" autoComplete="new-password" placeholder="Minimo 8 caracteres" className={inputClass} />
        </Field>
      ) : null}
      <div className="flex flex-col gap-2">
        <SubmitButton disabled={disabled} pendingLabel="Agregando..." className="btn btn-primary">
          <Plus className="size-4" />
          Agregar
        </SubmitButton>
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-medium text-stone-600">{label}{children}</label>;
}

function ActionFeedback({ state }: { state: UserActionResult }) {
  if (!state.message) return <span className="min-h-4 text-[11px] text-stone-400"> </span>;
  return (
    <span className={cn("text-[11px] font-medium", state.ok ? "text-emerald-700" : "text-rose-700")}>
      {state.message}
    </span>
  );
}

function StepCheckboxes({
  steps,
  disabled,
  selected = [],
}: {
  steps: Array<{ key: string; label: string }>;
  disabled: boolean;
  selected?: string[];
}) {
  return (
    <fieldset className="md:col-span-2">
      <legend className="text-xs font-medium text-stone-600">Procesos</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {steps.map((step) => (
          <label key={step.key} className="inline-flex h-9 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700">
            <input
              type="checkbox"
              name="areas"
              value={step.key}
              defaultChecked={selected.includes(step.key)}
              disabled={disabled}
              className="size-4 accent-stone-950"
            />
            {step.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function areaLabels(areas: string[], steps: Array<{ key: string; label: string }>) {
  return areas.map((area) => steps.find((step) => step.key === area)?.label ?? area).join(", ");
}

function userAreas(user: AppUser) {
  return user.areas?.length ? user.areas : user.area ? [user.area] : [];
}

function roleLabel(role: Role) {
  const labels: Record<Role, string> = {
    admin: "Administrador",
    manager: "Supervisor",
    operator: "Trabajador",
    viewer: "Lectura",
  };
  return labels[role];
}
