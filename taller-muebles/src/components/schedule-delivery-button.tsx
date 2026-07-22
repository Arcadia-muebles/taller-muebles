"use client";

import { CalendarDays, Truck } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { scheduleOrderDelivery } from "@/app/admin/agenda/actions";

export function ScheduleDeliveryButton({ orderId, defaultDate, itemCount = 1 }: { orderId: string; defaultDate: string; itemCount?: number }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 12, left: 12 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLFormElement>(null);

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const button = buttonRef.current?.getBoundingClientRect();
      const panel = panelRef.current?.getBoundingClientRect();
      if (!button || !panel) return;

      const gap = 8;
      const viewportPadding = 12;
      const fitsBelow = button.bottom + gap + panel.height <= window.innerHeight - viewportPadding;
      const preferredTop = fitsBelow ? button.bottom + gap : button.top - panel.height - gap;
      const preferredLeft = button.left - panel.width - gap;

      setPosition({
        top: Math.min(Math.max(viewportPadding, preferredTop), window.innerHeight - panel.height - viewportPadding),
        left: Math.min(Math.max(viewportPadding, preferredLeft), window.innerWidth - panel.width - viewportPadding),
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function closeFromOutside(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false);
    }

    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [open]);

  function toggleOpen() {
    setOpen((value) => !value);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-semibold uppercase text-white transition hover:bg-emerald-800"
      >
        <Truck className="size-3.5" />
        {itemCount > 1 ? `Agendar pedido (${itemCount})` : "Agendar"}
      </button>

      {open ? (
        <form
          ref={panelRef}
          action={scheduleOrderDelivery}
          onSubmit={() => setOpen(false)}
          style={{ top: position.top, left: position.left }}
          className="fixed z-[100] max-h-[calc(100vh-1.5rem)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-emerald-200 bg-white p-3 shadow-xl shadow-stone-950/10"
        >
          <input type="hidden" name="orderId" value={orderId} />
          <div className="grid grid-cols-[1.2fr_0.8fr] gap-2">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-900">Día</span>
              <input
                name="scheduledDate"
                type="date"
                required
                defaultValue={defaultDate}
                className="mt-1 h-9 w-full rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-stone-950 outline-none focus:border-emerald-600"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-900">Horario</span>
              <select
                name="timeSlot"
                defaultValue="AM"
                className="mt-1 h-9 w-full rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-stone-950 outline-none focus:border-emerald-600"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </label>
          </div>
          <label className="mt-2 block">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-900">Nota de entrega</span>
            <textarea
              name="notes"
              className="mt-1 h-16 w-full resize-none rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-xs font-medium text-stone-950 outline-none placeholder:text-stone-400 focus:border-emerald-600"
              maxLength={500}
              placeholder="Referencia, contacto, acceso o instruccion"
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-md border border-stone-200 bg-white px-2 text-xs font-semibold text-stone-700 hover:border-stone-300">
              Cancelar
            </button>
            <button type="submit" className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-2 text-xs font-semibold uppercase text-white hover:bg-emerald-800">
              <CalendarDays className="size-3.5" />
              Confirmar
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
