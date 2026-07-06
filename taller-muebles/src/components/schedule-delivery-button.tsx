"use client";

import { CalendarDays, Truck } from "lucide-react";
import { useRef, useState } from "react";
import { scheduleOrderDelivery } from "@/app/admin/agenda/actions";

export function ScheduleDeliveryButton({ orderId, defaultDate }: { orderId: string; defaultDate: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  function toggleOpen() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({
        top: Math.max(16, rect.top + rect.height / 2 - 112),
        left: Math.max(16, rect.left - 328),
      });
    }
    setOpen((value) => !value);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-semibold uppercase text-white transition hover:bg-emerald-800"
      >
        <Truck className="size-3.5" />
        Agendar
      </button>

      {open ? (
        <form
          action={scheduleOrderDelivery}
          style={{ top: position.top, left: position.left }}
          className="fixed z-50 w-80 rounded-lg border border-emerald-200 bg-white p-3 shadow-xl shadow-stone-950/10"
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
