"use client";

import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const weekdays = ["L", "M", "M", "J", "V", "S", "D"];

export function TouchDatePicker({
  name,
  value,
  onChange,
  onBlur,
  inputRef,
  ariaLabel,
}: {
  name: string;
  value?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  inputRef: React.Ref<HTMLInputElement>;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [initialValue, setInitialValue] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(() => monthFromValue(value));
  const dialogId = useId();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth]);

  function showCalendar() {
    setInitialValue(value ?? "");
    setVisibleMonth(monthFromValue(value));
    setOpen(true);
  }

  function cancel() {
    onChange(initialValue);
    setOpen(false);
    onBlur();
  }

  function finish() {
    setOpen(false);
    onBlur();
  }

  function chooseToday() {
    const today = formatIsoDate(new Date());
    onChange(today);
    setVisibleMonth(monthFromValue(today));
  }

  return (
    <>
      <input ref={inputRef} type="hidden" name={name} value={value ?? ""} readOnly />
      <div className="relative">
        <input
          type="text"
          value={formatDisplayDate(value)}
          placeholder="dd-mm-aaaa"
          aria-label={ariaLabel}
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={dialogId}
          readOnly
          onClick={showCalendar}
          onFocus={showCalendar}
          className="control-lg cursor-pointer bg-white pr-11 tabular-nums caret-transparent"
        />
        <CalendarDays
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-stone-500"
        />
      </div>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[100] grid place-items-center bg-stone-950/35 p-4">
              <div
                id={dialogId}
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel}
                className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-4 shadow-2xl"
              >
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
                    className="grid size-11 place-items-center rounded-lg border border-stone-200 text-stone-700 active:bg-stone-100"
                    aria-label="Mes anterior"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <p className="text-base font-semibold capitalize text-stone-950">
                    {visibleMonth.toLocaleDateString("es-CL", { month: "long", year: "numeric" })}
                  </p>
                  <button
                    type="button"
                    onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
                    className="grid size-11 place-items-center rounded-lg border border-stone-200 text-stone-700 active:bg-stone-100"
                    aria-label="Mes siguiente"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-7 gap-1 text-center">
                  {weekdays.map((day, index) => (
                    <span key={`${day}-${index}`} className="grid h-8 place-items-center text-xs font-semibold text-stone-500">
                      {day}
                    </span>
                  ))}
                  {days.map((day, index) =>
                    day ? (
                      <button
                        key={day}
                        type="button"
                        onClick={() => onChange(day)}
                        aria-pressed={value === day}
                        className={`grid size-11 place-items-center rounded-lg text-sm font-semibold tabular-nums transition active:scale-95 ${
                          value === day
                            ? "bg-stone-950 text-white"
                            : day === formatIsoDate(new Date())
                              ? "border border-stone-400 bg-stone-50 text-stone-950"
                              : "text-stone-700 active:bg-stone-100"
                        }`}
                      >
                        {Number(day.slice(-2))}
                      </button>
                    ) : (
                      <span key={`empty-${index}`} className="size-11" aria-hidden="true" />
                    ),
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-stone-200 pt-4">
                  <button type="button" onClick={cancel} className="btn-lg btn-secondary">
                    <X className="size-4" />
                    Cancelar
                  </button>
                  <button type="button" onClick={chooseToday} className="btn-lg btn-secondary ml-auto">
                    Hoy
                  </button>
                  <button type="button" onClick={finish} className="btn-lg btn-primary">
                    Listo
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function monthFromValue(value?: string) {
  const parsed = value ? parseIsoDate(value) : null;
  const source = parsed ?? new Date();
  return new Date(source.getFullYear(), source.getMonth(), 1, 12);
}

function calendarDays(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = (new Date(year, monthIndex, 1, 12).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0, 12).getDate();
  return [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => formatIsoDate(new Date(year, monthIndex, index + 1, 12))),
  ];
}

function addMonths(month: Date, amount: number) {
  return new Date(month.getFullYear(), month.getMonth() + amount, 1, 12);
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value?: string) {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}
