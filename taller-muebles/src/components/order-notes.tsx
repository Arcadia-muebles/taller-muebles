"use client";

import { CheckCircle2, Send, XCircle } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addOrderComment, resolveOrderComment, type CollaborationActionResult } from "@/app/admin/orders/collaboration-actions";
import type { OrderComment } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { SubmitButton } from "./submit-button";

const initialActionState: CollaborationActionResult = { ok: false, message: "" };

export function OrderNotes({
  orderId,
  comments,
  canComment,
  compact = false,
}: {
  orderId: string;
  comments: OrderComment[];
  canComment: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const activeComments = comments.filter((comment) => !comment.resolvedAt);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveState, setResolveState] = useState<CollaborationActionResult>(initialActionState);
  const [resolvePending, startResolveTransition] = useTransition();
  const [state, action] = useActionState(
    async (_state: CollaborationActionResult, formData: FormData) => {
      const result = await addOrderComment(formData);
      if (result.ok) {
        formRef.current?.reset();
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );

  function resolve(commentId: string) {
    setResolvingId(commentId);
    startResolveTransition(async () => {
      const result = await resolveOrderComment({ orderId, commentId });
      setResolveState(result);
      if (result.ok) router.refresh();
      setResolvingId(null);
    });
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className={compact ? "max-h-72 overflow-y-auto px-4 py-3" : "max-h-96 overflow-y-auto p-4"}>
        <div className="space-y-3">
          {activeComments.map((comment) => (
            <article key={comment.id} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-stone-900">{comment.author}</p>
                  {comment.authorContext ? (
                    <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-600">
                      {comment.authorContext}
                    </span>
                  ) : null}
                </div>
                <time className="shrink-0 text-[11px] font-medium text-stone-400" dateTime={comment.createdAt}>
                  {formatDateTime(comment.createdAt)}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-stone-700">{comment.body}</p>
              {canComment ? (
                <div className="mt-3 flex justify-end border-t border-stone-200 pt-2">
                  <button
                    type="button"
                    onClick={() => resolve(comment.id)}
                    disabled={resolvePending}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                    aria-label={`Marcar observación de ${comment.author} como lista`}
                  >
                    <CheckCircle2 className="size-3.5" />
                    {resolvePending && resolvingId === comment.id ? "Marcando..." : "Marcar lista"}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
          {!activeComments.length ? (
            <div className="rounded-lg border border-dashed border-stone-200 px-4 py-6 text-center">
              <CheckCircle2 className="mx-auto size-5 text-emerald-500" />
              <p className="mt-2 text-sm font-medium text-stone-600">No hay observaciones pendientes.</p>
              <p className="mt-1 text-xs text-stone-400">Las observaciones marcadas como listas dejan de aparecer aquí.</p>
            </div>
          ) : null}
        </div>
      </div>

      {canComment ? (
        <form ref={formRef} action={action} className="border-t border-stone-200 bg-white p-4">
          <input type="hidden" name="orderId" value={orderId} />
          <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-stone-500" htmlFor={`order-note-${orderId}`}>
            Nueva nota
          </label>
          <textarea
            id={`order-note-${orderId}`}
            name="body"
            required
            minLength={2}
            maxLength={1000}
            autoFocus={compact}
            placeholder="Ej.: Costura lista; falta confirmar el color del hilo."
            className="mt-2 min-h-20 w-full resize-y rounded-md border border-stone-200 bg-white px-3 py-2 text-sm leading-5 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
          />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <ActionFeedback state={resolveState.message ? resolveState : state} />
            <SubmitButton
              pendingLabel="Publicando..."
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
            >
              <Send className="size-3.5" />
              Publicar nota
            </SubmitButton>
          </div>
        </form>
      ) : (
        <p className="border-t border-stone-200 px-4 py-3 text-xs text-stone-500">Tu perfil tiene acceso de solo lectura.</p>
      )}
    </div>
  );
}

function ActionFeedback({ state }: { state: CollaborationActionResult }) {
  if (!state.message) return <span className="text-xs text-stone-400">La nota quedará identificada con tu nombre y área.</span>;
  const Icon = state.ok ? CheckCircle2 : XCircle;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>
      <Icon className="size-3.5" />
      {state.message}
    </span>
  );
}

export function useCloseOnEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    function close(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose, open]);
}
