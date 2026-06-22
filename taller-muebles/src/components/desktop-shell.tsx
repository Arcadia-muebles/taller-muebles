"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type DesktopShellProps = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
};

export function DesktopShell({ sidebar, children }: DesktopShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen overflow-x-hidden bg-stone-100 text-stone-950">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-stone-200 bg-white transition-[width] duration-200 lg:block",
          sidebarOpen ? "w-64" : "w-14",
        )}
      >
        <button
          type="button"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-expanded={sidebarOpen}
          aria-label={sidebarOpen ? "Ocultar barra lateral" : "Mostrar barra lateral"}
          title={sidebarOpen ? "Ocultar barra lateral" : "Mostrar barra lateral"}
          className="absolute right-2 top-5 z-10 grid size-8 place-items-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-stone-950"
        >
          {sidebarOpen ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
        </button>

        <div
          className={cn(
            "h-full w-64 px-4 py-5 transition-opacity duration-150",
            sidebarOpen ? "opacity-100" : "pointer-events-none invisible opacity-0",
          )}
        >
          {sidebar}
        </div>
      </aside>

      <main className={cn("min-w-0 transition-[padding] duration-200", sidebarOpen ? "lg:pl-64" : "lg:pl-14")}>
        <div className="flex min-h-screen w-full min-w-0 flex-col px-4 py-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
