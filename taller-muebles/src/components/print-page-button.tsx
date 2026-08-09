"use client";

import { Printer } from "lucide-react";

export function PrintPageButton({
  className = "btn btn-secondary",
  bodyClassName,
}: {
  className?: string;
  bodyClassName?: "printing-agenda";
}) {
  function printPage() {
    if (!bodyClassName) {
      window.print();
      return;
    }

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      window.removeEventListener("afterprint", cleanup);
      document.body.classList.remove(bodyClassName);
    };

    document.body.classList.add(bodyClassName);
    window.addEventListener("afterprint", cleanup, { once: true });
    window.requestAnimationFrame(() => {
      window.print();
      window.setTimeout(cleanup, 60_000);
    });
  }

  return (
    <button type="button" onClick={printPage} className={className}>
      <Printer className="size-4" />
      Imprimir
    </button>
  );
}
