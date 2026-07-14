import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-stone-100 p-4 text-stone-950">
      <section className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <span className="grid size-11 place-items-center rounded-lg bg-stone-100 text-stone-700">
          <SearchX className="size-5" />
        </span>
        <p className="page-kicker mt-5">Página no encontrada</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">No encontramos este registro</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Puede que el enlace esté incompleto, el registro ya no esté disponible o no tengas acceso a él.
        </p>
        <Link href="/" className="btn btn-primary mt-6 w-full">
          <ArrowLeft className="size-4" />
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
