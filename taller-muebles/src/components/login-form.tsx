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
    <form action={formAction} className="panel-pad min-w-0 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-lg bg-stone-950 text-white">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Acceso interno</h1>
          <p className="text-sm text-stone-500">Clientes B2B: Leather House / La Reina</p>
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
            placeholder={panel === "admin" ? "admin@taller.local" : "taller@taller.local"}
            className="control-lg pl-9"
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
            className="control-lg pl-9"
          />
        </div>
      </label>

      <label className="mt-4 block">
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
      </label>

      {!supabaseEnabled ? (
        <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3 text-xs leading-5 text-stone-600">
          {panel === "admin" ? (
            <>
              <p className="font-semibold text-stone-800">Cuenta admin demo</p>
              <p>admin@taller.local</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-stone-800">Cuentas taller demo</p>
              <p>taller@taller.local</p>
              <p>estructura@taller.local / corte@taller.local / costura@taller.local</p>
              <p>tapiceria@taller.local / calidad@taller.local</p>
            </>
          )}
        </div>
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
        className="btn-lg btn-primary mt-5 w-full"
      >
        {pending ? "Entrando..." : "Entrar"}
      </button>

      <p className="mt-4 text-xs leading-5 text-stone-500">
        {supabaseEnabled
          ? "Acceso protegido. Tu perfil determina automaticamente los modulos y acciones disponibles."
          : "Modo local de desarrollo: usa una cuenta demo o una cuenta creada por un administrador. La clave puede ser cualquier texto."}
      </p>
    </form>
  );
}
