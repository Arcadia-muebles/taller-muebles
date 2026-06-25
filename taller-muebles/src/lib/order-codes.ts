import type { StoreCode } from "@/lib/types";

export function shortOrderCode(code: string) {
  const normalized = code.trim();
  const match = /^(LH|LR)-\d{4}-(\d+)$/i.exec(normalized);
  if (!match) return normalized;
  return `${match[1].toUpperCase()}-${String(Number(match[2])).padStart(3, "0")}`;
}

export function nextOrderCodeForStore(store: StoreCode, codes: string[]) {
  const max = codes.reduce((current, code) => {
    const shortened = shortOrderCode(code);
    const match = new RegExp(`^${store}-?(\\d+)$`).exec(shortened);
    if (!match) return current;
    return Math.max(current, Number(match[1]));
  }, 0);
  return `${store}-${String(max + 1).padStart(3, "0")}`;
}
