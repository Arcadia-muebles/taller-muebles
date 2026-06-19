"use client";

import { CheckCircle2, Download, FileUp, MessageSquarePlus, Paperclip, XCircle } from "lucide-react";
import { useActionState, useRef } from "react";
import {
  addOrderComment,
  type CollaborationActionResult,
  uploadOrderAttachment,
} from "@/app/admin/orders/collaboration-actions";
import type { OrderAttachment, OrderComment, ProductionStep } from "@/lib/types";
import { SubmitButton } from "./submit-button";

const initialActionState: CollaborationActionResult = { ok: false, message: "" };

export function OrderCollaboration({
  orderId,
  comments,
  attachments,
  canUpload,
  steps = [],
  defaultStepKey,
}: {
  orderId: string;
  comments: OrderComment[];
  attachments: OrderAttachment[];
  canUpload: boolean;
  steps?: ProductionStep[];
  defaultStepKey?: string;
}) {
  const commentFormRef = useRef<HTMLFormElement>(null);
  const uploadFormRef = useRef<HTMLFormElement>(null);
  const [commentState, commentAction] = useActionState(
    async (_state: CollaborationActionResult, formData: FormData) => {
      const result = await addOrderComment(formData);
      if (result.ok) commentFormRef.current?.reset();
      return result;
    },
    initialActionState,
  );
  const [uploadState, uploadAction] = useActionState(
    async (_state: CollaborationActionResult, formData: FormData) => {
      const result = await uploadOrderAttachment(formData);
      if (result.ok) uploadFormRef.current?.reset();
      return result;
    },
    initialActionState,
  );

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-lg border border-stone-200 bg-white">
        <div className="flex items-center gap-3 border-b border-stone-200 p-4">
          <MessageSquarePlus className="size-5 text-stone-500" />
          <div>
            <h2 className="text-base font-semibold">Comentarios</h2>
            <p className="text-sm text-stone-500">Coordinación y decisiones sobre la orden.</p>
          </div>
        </div>
        <form ref={commentFormRef} action={commentAction} className="border-b border-stone-100 p-4">
          <input type="hidden" name="orderId" value={orderId} />
          {steps.length ? (
            <label className="mb-3 block text-xs font-medium uppercase tracking-[0.12em] text-stone-500">
              Etapa del proceso
              <select
                name="stepKey"
                defaultValue={defaultStepKey ?? ""}
                className="mt-2 w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm normal-case tracking-normal text-stone-700 outline-none transition focus:border-stone-400 focus:bg-white"
              >
                <option value="">Comentario general</option>
                {steps.map((step) => (
                  <option key={step.key} value={step.key}>
                    {step.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <textarea
            name="body"
            required
            minLength={2}
            maxLength={1000}
            placeholder="Agregar comentario operativo..."
            className="min-h-24 w-full resize-none rounded-md border border-stone-200 bg-stone-50 p-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
          />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <ActionFeedback state={commentState} />
            <SubmitButton pendingLabel="Publicando..." className="h-9 rounded-md bg-stone-950 px-3 text-sm font-medium text-white disabled:opacity-50">
              Publicar comentario
            </SubmitButton>
          </div>
        </form>
        <div className="max-h-80 divide-y divide-stone-100 overflow-y-auto">
          {comments.map((comment) => (
            <article key={comment.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{comment.author}</p>
                  <p className="mt-0.5 text-xs text-stone-500">{comment.stepLabel ?? "Comentario general"}</p>
                </div>
                <time className="text-[11px] font-medium uppercase tracking-[0.1em] text-stone-400">
                  {new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(comment.createdAt))}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-600">{comment.body}</p>
            </article>
          ))}
          {!comments.length ? <p className="p-5 text-sm text-stone-500">No hay comentarios todavía.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white">
        <div className="flex items-center gap-3 border-b border-stone-200 p-4">
          <Paperclip className="size-5 text-stone-500" />
          <div>
            <h2 className="text-base font-semibold">Adjuntos</h2>
            <p className="text-sm text-stone-500">Planos, fotografías y documentos de apoyo.</p>
          </div>
        </div>
        {canUpload ? (
          <form ref={uploadFormRef} action={uploadAction} className="border-b border-stone-100 p-4">
            <input type="hidden" name="orderId" value={orderId} />
            <label className="block text-xs font-medium uppercase tracking-[0.12em] text-stone-500">
              Archivo, máximo 10 MB
              <input
                name="file"
                required
                type="file"
                className="mt-2 block w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-stone-200 file:px-3 file:py-1.5 file:text-xs file:font-medium"
              />
            </label>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <ActionFeedback state={uploadState} />
              <SubmitButton pendingLabel="Subiendo..." className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-medium text-white disabled:opacity-50">
                <FileUp className="size-4" />
                Subir
              </SubmitButton>
            </div>
          </form>
        ) : null}
        <div className="max-h-80 divide-y divide-stone-100 overflow-y-auto">
          {attachments.map((attachment) => (
            <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 p-4 transition hover:bg-stone-50">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{attachment.fileName}</p>
                <p className="mt-1 text-xs text-stone-500">{formatBytes(attachment.fileSize)} / {attachment.fileType}</p>
              </div>
              <Download className="size-4 shrink-0 text-stone-400" />
            </a>
          ))}
          {!attachments.length ? <p className="p-5 text-sm text-stone-500">No hay archivos adjuntos.</p> : null}
        </div>
      </section>
    </div>
  );
}

function ActionFeedback({ state }: { state: CollaborationActionResult }) {
  if (!state.message) {
    return <span className="text-xs text-stone-400">Los cambios se guardan en la actividad de la orden.</span>;
  }

  const Icon = state.ok ? CheckCircle2 : XCircle;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>
      <Icon className="size-3.5" />
      {state.message}
    </span>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "Tamaño no disponible";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
