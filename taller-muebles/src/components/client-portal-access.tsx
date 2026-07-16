"use client";

import { Check, Copy, ExternalLink, Link2, RotateCcw, ShieldOff } from "lucide-react";
import { useActionState, useState } from "react";
import {
  generateClientPortalLink,
  revokeClientPortalLink,
  type ClientPortalActionState,
} from "@/app/admin/orders/portal-actions";
import type { ClientPortalLinkSummary } from "@/lib/client-portal";

const initialState: ClientPortalActionState = { ok: false, message: "" };

export function ClientPortalAccess({
  orderId,
  activeLink,
}: {
  orderId: string;
  activeLink?: ClientPortalLinkSummary;
}) {
  const [generateState, generateAction, generating] = useActionState(generateClientPortalLink, initialState);
  const [revokeState, revokeAction, revoking] = useActionState(revokeClientPortalLink, initialState);
  const [copiedPath, setCopiedPath] = useState<string>();
  const path = generateState.path;
  const copied = copiedPath === path;

  async function copyLink() {
    if (!path) return;
    await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
    setCopiedPath(path);
  }

  return (
    <section className="mt-5 rounded-lg border border-stone-200 bg-stone-50 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-stone-200 bg-white text-stone-700">
            <Link2 className="size-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-stone-950">Portal Cliente</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-600">
              Comparte un seguimiento público de esta nota. Sólo muestra productos, avance y fecha de entrega.
            </p>
            {activeLink ? (
              <p className="mt-2 text-xs font-medium text-emerald-700">
                Enlace activo hasta {formatDate(activeLink.expiresAt)}.
              </p>
            ) : (
              <p className="mt-2 text-xs font-medium text-stone-500">No hay un enlace activo.</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <form action={generateAction}>
            <input type="hidden" name="orderId" value={orderId} />
            <button type="submit" disabled={generating || revoking} className="btn btn-primary">
              {activeLink ? <RotateCcw className="size-4" /> : <ExternalLink className="size-4" />}
              {generating ? "Creando…" : activeLink ? "Generar uno nuevo" : "Crear enlace"}
            </button>
          </form>
          {activeLink ? (
            <form action={revokeAction}>
              <input type="hidden" name="orderId" value={orderId} />
              <button type="submit" disabled={generating || revoking} className="btn btn-danger">
                <ShieldOff className="size-4" />
                {revoking ? "Revocando…" : "Revocar"}
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {path ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-950">{generateState.message}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={path}
              aria-label="Enlace del Portal Cliente"
              className="control min-w-0 flex-1 border-emerald-200 bg-white font-mono text-xs"
            />
            <button type="button" onClick={copyLink} className="btn btn-secondary shrink-0 border-emerald-200">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copiado" : "Copiar enlace"}
            </button>
          </div>
          <p className="mt-2 text-xs text-emerald-800">Vence el {formatDate(generateState.expiresAt)}. Crear otro enlace invalida el anterior.</p>
        </div>
      ) : null}

      {!generateState.ok && generateState.message ? <p className="mt-3 text-sm text-rose-700">{generateState.message}</p> : null}
      {revokeState.message ? (
        <p className={`mt-3 text-sm ${revokeState.ok ? "text-stone-600" : "text-rose-700"}`}>{revokeState.message}</p>
      ) : null}
    </section>
  );
}

function formatDate(value?: string) {
  if (!value) return "fecha no disponible";
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}
