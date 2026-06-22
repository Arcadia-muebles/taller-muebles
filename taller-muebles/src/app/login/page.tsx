import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { dashboardPathForRole, getSessionUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(dashboardPathForRole(user.role));

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-6 text-stone-950">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] w-full max-w-5xl items-center gap-8 lg:grid-cols-[1fr_420px]">
        <section className="min-w-0">
          <p className="page-kicker">
            Sistema interno
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
            Una sola plataforma para administracion y taller.
          </h2>
          <p className="page-description mt-4 max-w-xl">
            Todos entran por esta pantalla. El rol de la cuenta decide si el usuario
            abre el panel administrador o la cola del taller, y los trabajadores solo
            ven las ordenes y etapas asignadas a su usuario.
          </p>
        </section>

        <LoginForm supabaseEnabled={hasSupabaseConfig()} />
      </div>
    </main>
  );
}
