import { LoginForm } from "@/components/login-form";
import { hasSupabaseConfig } from "@/lib/env";

export default function LoginPage() {
  return (
    <main className="min-h-screen w-full bg-[#FAF6F0] flex flex-col items-center justify-center p-6 text-stone-900 font-sans">
      <div className="w-full max-w-[540px] flex flex-col">
        {/* Brand header */}
        <div className="text-center mb-8 select-none">
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-[#9E7A5A]">
            Muebles en Cuero
          </p>
          <h1 className="mt-2 text-[38px] font-medium tracking-tight text-stone-900 font-serif leading-tight">
            Control de Producción
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Acceso al sistema interno
          </p>
        </div>

        {/* Login form and demo credentials */}
        <LoginForm supabaseEnabled={hasSupabaseConfig()} />

        {/* Brand footer */}
        <p className="mt-10 text-center text-[10px] text-stone-400 font-medium tracking-[0.15em] select-none">
          Leather House &bull; La Reina
        </p>
      </div>
    </main>
  );
}
