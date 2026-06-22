"use client";

import { useActionState } from "react";
import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import { requestLogin, type LoginState } from "@/app/login/actions";

const initialState: LoginState = {
  status: "idle",
  message: "",
};

export function LoginForm({ supabaseEnabled }: { supabaseEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(requestLogin, initialState);

  return (
    <form action={formAction} className="panel-pad min-w-0 p-5 shadow-sm">
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
            placeholder="nombre@taller.cl"
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

      {!supabaseEnabled ? (
        <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3 text-xs leading-5 text-stone-600">
          <p className="font-semibold text-stone-800">Cuentas demo</p>
          <p>Administrador: admin@taller.local</p>
          <p>Supervisor: supervisor@taller.local</p>
          <p>Taller: taller@taller.local</p>
          <p className="mt-1">El sistema abre automaticamente el panel correspondiente.</p>
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
