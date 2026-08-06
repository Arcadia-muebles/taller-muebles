"use client";

import { MessageSquareText, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Order, OrderAttachment, OrderComment } from "@/lib/types";
import { cn, hasMeaningfulObservations } from "@/lib/utils";
import { OrderCollaboration } from "./order-collaboration";
import { useCloseOnEscape } from "./order-notes";

export function OrderNotesDialog({
  order,
  comments,
  attachments,
  canComment,
}: {
  order: Pick<Order, "id" | "code" | "client" | "observations">;
  comments: OrderComment[];
  attachments: OrderAttachment[];
  canComment: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const notificationCount = comments.length + attachments.length;

  useCloseOnEscape(open, close);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={`Abrir observaciones de ${order.code}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(
          "relative grid size-7 shrink-0 place-items-center rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-500 md:size-6",
          notificationCount
            ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
            : "border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-800",
        )}
        title={notificationCount ? `${comments.length} notas y ${attachments.length} adjuntos` : "Agregar observación"}
      >
        <MessageSquareText className="size-3.5" />
        {notificationCount ? (
          <span className="absolute -right-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-stone-900 px-1 text-[9px] font-bold leading-4 text-white">
            {notificationCount > 9 ? "9+" : notificationCount}
          </span>
        ) : null}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-end justify-center bg-stone-950/35 p-0 backdrop-blur-[1px] sm:items-center sm:p-5" onMouseDown={close}>
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby={`notes-title-${order.id}`}
                onMouseDown={(event) => event.stopPropagation()}
                className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-stone-200 bg-white shadow-2xl sm:max-w-xl sm:rounded-xl"
              >
                <header className="flex items-start justify-between gap-4 border-b border-stone-200 px-4 py-4 sm:px-5">
                  <div className="min-w-0">
                    <h2 id={`notes-title-${order.id}`} className="truncate text-base font-semibold text-stone-950">
                      Observaciones · {order.code}
                    </h2>
                    <p className="mt-1 truncate text-sm text-stone-500">{order.client}</p>
                  </div>
                  <button type="button" onClick={close} aria-label="Cerrar observaciones" className="grid size-9 shrink-0 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900">
                    <X className="size-4" />
                  </button>
                </header>

                {hasMeaningfulObservations(order.observations) ? (
                  <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 sm:px-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800">Indicación inicial del pedido</p>
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-5 text-amber-950">{order.observations}</p>
                  </div>
                ) : null}

                <OrderCollaboration
                  orderId={order.id}
                  comments={comments}
                  attachments={attachments}
                  canComment={canComment}
                  canUpload={canComment}
                  compact
                />
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
