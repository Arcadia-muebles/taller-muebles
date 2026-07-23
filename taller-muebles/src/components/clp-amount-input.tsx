"use client";

import { useState } from "react";

export function ClpAmountInput({
  name,
  defaultValue,
  className,
  placeholder = "Monto",
}: {
  name: string;
  defaultValue?: number;
  className?: string;
  placeholder?: string;
}) {
  const [amount, setAmount] = useState(defaultValue ?? 0);

  return (
    <>
      <input type="hidden" name={name} value={amount || ""} />
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required
        value={formatClp(amount)}
        onChange={(event) => setAmount(parseClp(event.target.value))}
        placeholder={placeholder}
        className={className}
      />
    </>
  );
}

function formatClp(value: number) {
  if (!value) return "";
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(value);
}

function parseClp(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}
