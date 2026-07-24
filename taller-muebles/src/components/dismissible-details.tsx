"use client";

import { type ComponentPropsWithoutRef, useEffect, useRef, useState } from "react";

type DismissibleDetailsProps = ComponentPropsWithoutRef<"details">;

export function DismissibleDetails({
  children,
  onToggle,
  ...props
}: DismissibleDetailsProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(Boolean(props.open));

  useEffect(() => {
    if (!open) return;

    function close(returnFocus = false) {
      const details = detailsRef.current;
      if (!details) return;
      details.open = false;
      if (returnFocus) details.querySelector<HTMLElement>("summary")?.focus();
    }

    function closeOnPointerDown(event: PointerEvent) {
      if (detailsRef.current?.contains(event.target as Node)) return;
      close();
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      close(true);
    }

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <details
      {...props}
      ref={detailsRef}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
        onToggle?.(event);
      }}
    >
      {children}
    </details>
  );
}
