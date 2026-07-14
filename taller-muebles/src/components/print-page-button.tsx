"use client";

import { Printer } from "lucide-react";

export function PrintPageButton({ className = "btn btn-secondary" }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      <Printer className="size-4" />
      Imprimir
    </button>
  );
}
