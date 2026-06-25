"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type DesktopShellProps = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
};

export function DesktopShell({ sidebar, children }: DesktopShellProps) {
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarPeeking, setSidebarPeeking] = useState(false);
  const sidebarExpanded = sidebarPinned || sidebarPeeking;

  return (
    <div className="min-h-screen overflow-x-hidden bg-stone-100 text-stone-950">
      <aside
        onMouseEnter={() => setSidebarPeeking(true)}
        onMouseLeave={() => setSidebarPeeking(false)}
        onFocus={() => setSidebarPeeking(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setSidebarPeeking(false);
        }}
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-stone-200 bg-white shadow-xl shadow-stone-950/5 transition-[width] duration-200 lg:block",
          sidebarExpanded ? "w-64" : "w-14",
        )}
      >
        <button
          type="button"
          onClick={() => setSidebarPinned((pinned) => !pinned)}
          aria-pressed={sidebarPinned}
          aria-expanded={sidebarExpanded}
          aria-label={sidebarPinned ? "Desfijar barra lateral" : "Fijar barra lateral"}
          title={sidebarPinned ? "Desfijar barra lateral" : "Fijar barra lateral"}
          className="absolute right-2 top-5 z-10 grid size-8 place-items-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-stone-950"
        >
          {sidebarPinned ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
        </button>

        <div
          className={cn(
            "h-full w-64 px-4 py-5 transition-opacity duration-150",
            sidebarExpanded ? "opacity-100" : "pointer-events-none invisible opacity-0",
          )}
        >
          {sidebar}
        </div>
      </aside>

      <main className={cn("min-w-0 transition-[padding] duration-200", sidebarPinned ? "lg:pl-64" : "lg:pl-14")}>
        <div className="flex min-h-screen w-full min-w-0 flex-col px-4 py-4 sm:px-5 lg:px-6 xl:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
