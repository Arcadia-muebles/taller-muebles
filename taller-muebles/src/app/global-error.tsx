"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Error de aplicación", error);
  }, [error]);

  return (
    <html lang="es">
      <body className="m-0 grid min-h-screen place-items-center bg-stone-100 p-4 font-sans text-stone-950">
        <main className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <span className="grid size-11 place-items-center rounded-lg bg-amber-50 text-amber-700">
            <AlertTriangle className="size-5" />
          </span>
          <p className="mt-5 text-xs font-medium uppercase tracking-[0.18em] text-stone-500">Error temporal</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">No pudimos cargar esta pantalla</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Intenta cargarla nuevamente. Si el problema continúa, informa al administrador con la hora en que ocurrió.
          </p>
          <button type="button" onClick={() => unstable_retry()} className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-medium text-white transition hover:bg-stone-800">
            <RotateCcw className="size-4" />
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
