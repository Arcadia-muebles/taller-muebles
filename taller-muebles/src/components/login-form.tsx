"use client";

import { useActionState, useState } from "react";
import { Mail, User, Wrench, Eye, EyeOff, Lock } from "lucide-react";
import { requestLogin, type LoginState } from "@/app/login/actions";

const initialState: LoginState = {
  status: "idle",
  message: "",
};

export function LoginForm({ supabaseEnabled }: { supabaseEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(requestLogin, initialState);
  const [panel, setPanel] = useState<"admin" | "taller">("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const fillDemoAccount = (demoEmail: string, demoPassword: string, demoPanel: "admin" | "taller") => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setPanel(demoPanel);
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Tarjeta de login principal */}
      <form
        action={formAction}
        className="w-full bg-white p-8 rounded-[24px] border border-stone-200/40 shadow-[0_16px_36px_rgba(27,24,20,0.04)] flex flex-col gap-5 text-stone-900"
      >
        {/* Selector de panel */}
        <div className="flex flex-col gap-1.5 select-none">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-stone-200 bg-stone-50/50 p-1">
            <button
              type="button"
              onClick={() => setPanel("admin")}
              className={`flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                panel === "admin"
                  ? "bg-[#F5ECE5] text-stone-900 border border-[#D9C3B0]/60 shadow-sm font-semibold"
                  : "text-stone-500 hover:text-stone-850"
              }`}
            >
              <User className="size-4" />
              Administración
            </button>
            <button
              type="button"
              onClick={() => setPanel("taller")}
              className={`flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                panel === "taller"
                  ? "bg-[#F5ECE5] text-stone-900 border border-[#D9C3B0]/60 shadow-sm font-semibold"
                  : "text-stone-500 hover:text-stone-850"
              }`}
            >
              <Wrench className="size-4" />
              Taller / Operario
            </button>
            {/* Campo oculto para pasar el panel seleccionado en la acción de formulario */}
            <input type="hidden" name="panel" value={panel} />
          </div>
        </div>

        {/* Correo Electrónico */}
        <div className="flex flex-col gap-1.5 mt-1">
          <label className="text-xs font-semibold text-stone-600 tracking-wide">
            Correo electrónico
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@taller.local"
              className="h-12 w-full rounded-xl border border-stone-200 bg-white pl-10 pr-4 text-sm outline-none transition-all duration-150 focus:border-[#9E7A5A] focus:ring-4 focus:ring-[#9E7A5A]/10 text-stone-900"
              required
            />
          </div>
        </div>

        {/* Contraseña */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-stone-600 tracking-wide">
            Contraseña
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="h-12 w-full rounded-xl border border-stone-200 bg-white pl-10 pr-10 text-sm outline-none transition-all duration-150 focus:border-[#9E7A5A] focus:ring-4 focus:ring-[#9E7A5A]/10 text-stone-900"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {/* Mensajes de error/éxito */}
        {state.message ? (
          <div
            className={`rounded-xl border p-3.5 text-xs font-medium leading-relaxed transition-all duration-150 ${
              state.status === "success"
                ? "border-emerald-100 bg-emerald-50/50 text-emerald-800"
                : "border-rose-100 bg-rose-50/50 text-rose-800"
            }`}
          >
            {state.message}
          </div>
        ) : null}

        {/* Botón de envío */}
        <button
          type="submit"
          disabled={pending}
          className="mt-2 h-12 w-full rounded-xl bg-[#0F0E0C] text-white text-sm font-semibold tracking-wide transition duration-150 hover:bg-[#1F1D19] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Entrando..." : "Entrar al sistema"}
        </button>
      </form>

      {/* Credenciales Demo fijas */}
      {!supabaseEnabled ? (
        <div className="w-full">
          <div className="relative flex items-center justify-center my-6 select-none">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200/60" />
            </div>
            <span className="relative bg-[#FAF6F0] px-3 text-[10px] font-bold text-[#9E7A5A] tracking-[0.25em] uppercase">
              Credenciales Demo
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Box Admin */}
            <button
              type="button"
              onClick={() => fillDemoAccount("admin@taller.local", "Admin123", "admin")}
              className="flex items-center gap-4 p-4 rounded-xl bg-white border border-stone-200/50 hover:bg-[#FAF6F0]/50 hover:border-[#D9C3B0] text-left transition duration-200 shadow-sm shadow-stone-100/50 group"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FAF6F0] text-[#9E7A5A] group-hover:bg-[#F5ECE5] transition">
                <User className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-stone-800">Admin</p>
                <p className="text-xs text-stone-500 font-medium truncate">admin@taller.local</p>
                <p className="text-[11px] text-[#9E7A5A] font-semibold mt-0.5">Clave: Admin123</p>
              </div>
            </button>

            {/* Box Trabajador */}
            <button
              type="button"
              onClick={() => fillDemoAccount("operario@taller.local", "Taller123", "taller")}
              className="flex items-center gap-4 p-4 rounded-xl bg-white border border-stone-200/50 hover:bg-[#FAF6F0]/50 hover:border-[#D9C3B0] text-left transition duration-200 shadow-sm shadow-stone-100/50 group"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FAF6F0] text-[#9E7A5A] group-hover:bg-[#F5ECE5] transition">
                <Wrench className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-stone-800">Trabajador del taller</p>
                <p className="text-xs text-stone-500 font-medium truncate">operario@taller.local</p>
                <p className="text-[11px] text-[#9E7A5A] font-semibold mt-0.5">Clave: Taller123</p>
              </div>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
