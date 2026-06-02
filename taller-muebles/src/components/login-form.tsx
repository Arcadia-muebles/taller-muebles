"use client";

import { useActionState } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import { requestLogin, type LoginState } from "@/app/login/actions";

const initialState: LoginState = {
  status: "idle",
  message: "",
};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(requestLogin, initialState);

  return (
    <form action={formAction} className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
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
        {pending ? "Enviando..." : "Enviar enlace de acceso"}
      </button>

      <p className="mt-4 text-xs leading-5 text-stone-500">
        La version real usara autenticacion Supabase. El rol del usuario define si ve
        panel administrador, taller o solo lectura.
      </p>
    </form>
  );
}
