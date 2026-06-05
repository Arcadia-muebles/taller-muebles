"use client";

import { useActionState, useState } from "react";
import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import { requestLogin, type LoginState } from "@/app/login/actions";

const initialState: LoginState = {
  status: "idle",
  message: "",
};

export function LoginForm({ supabaseEnabled }: { supabaseEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(requestLogin, initialState);
  const [panel, setPanel] = useState<"admin" | "taller">("admin");

  return (
    <form action={formAction} className="min-w-0 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-lg bg-stone-950 text-white">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Acceso interno</h1>
          <p className="text-sm text-stone-500">Leather House / La Reina</p>
        </div>
      </div>

      <label className="mt-6 block">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
          Correo
        </span>
        <div className="relative mt-2">
          <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="rodrigo@empresa.cl"
            className="h-11 w-full rounded-md border border-stone-200 bg-stone-50 pl-9 pr-3 text-sm outline-none transition focus:border-stone-500 focus:bg-white"
          />
        </div>
      </label>

      <label className="mt-4 block">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
          Clave
        </span>
        <div className="relative mt-2">
          <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder={supabaseEnabled ? "Tu clave de acceso" : "Cualquier clave"}
            className="h-11 w-full rounded-md border border-stone-200 bg-stone-50 pl-9 pr-3 text-sm outline-none transition focus:border-stone-500 focus:bg-white"
          />
        </div>
      </label>

      {!supabaseEnabled ? <label className="mt-4 block">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
          Entrar a
        </span>
        <div className="mt-2 grid grid-cols-2 overflow-hidden rounded-md border border-stone-200 bg-stone-50 p-1">
          <label className="has-[:checked]:bg-white has-[:checked]:shadow-sm flex h-10 cursor-pointer items-center justify-center rounded px-3 text-sm font-medium text-stone-700">
            <input className="sr-only" type="radio" name="panel" value="admin" checked={panel === "admin"} onChange={() => setPanel("admin")} />
            Admin
          </label>
          <label className="has-[:checked]:bg-white has-[:checked]:shadow-sm flex h-10 cursor-pointer items-center justify-center rounded px-3 text-sm font-medium text-stone-700">
            <input className="sr-only" type="radio" name="panel" value="taller" checked={panel === "taller"} onChange={() => setPanel("taller")} />
            Taller
          </label>
        </div>
      </label> : null}
      {supabaseEnabled ? <input type="hidden" name="panel" value="admin" /> : null}

      {!supabaseEnabled && panel === "taller" ? (
        <label className="mt-4 block">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
            Área asignada
          </span>
          <select name="area" defaultValue="structure" className="mt-2 h-11 w-full rounded-md border border-stone-200 bg-stone-50 px-3 text-sm outline-none transition focus:border-stone-500 focus:bg-white">
            <option value="structure">Estructura</option>
            <option value="cutting">Corte</option>
            <option value="sewing">Costura</option>
            <option value="upholstery">Tapicería</option>
            <option value="quality">Revisión y calidad</option>
          </select>
          <p className="mt-2 text-xs leading-5 text-stone-500">
            El operario solo podrá actualizar etapas de esta área.
          </p>
        </label>
      ) : null}

      {state.message ? (
        <div
          className={
            state.status === "success"
              ? "mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
              : "mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
          }
        >
          {state.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-stone-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Entrando..." : "Entrar"}
      </button>

      <p className="mt-4 text-xs leading-5 text-stone-500">
        {supabaseEnabled
          ? "Acceso protegido. Tu perfil determina automáticamente los módulos y acciones disponibles."
          : "Modo local de desarrollo: cualquier correo y clave sirven. Selecciona el panel y área para simular permisos."}
      </p>
    </form>
  );
}
