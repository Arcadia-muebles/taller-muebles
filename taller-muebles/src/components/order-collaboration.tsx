import { Download, FileUp, MessageSquarePlus, Paperclip } from "lucide-react";
import { addOrderComment, uploadOrderAttachment } from "@/app/admin/orders/collaboration-actions";
import type { OrderAttachment, OrderComment } from "@/lib/types";
import { SubmitButton } from "./submit-button";

export function OrderCollaboration({
  orderId,
  comments,
  attachments,
  canUpload,
}: {
  orderId: string;
  comments: OrderComment[];
  attachments: OrderAttachment[];
  canUpload: boolean;
}) {
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
        <form action={addOrderComment} className="border-b border-stone-100 p-4">
          <input type="hidden" name="orderId" value={orderId} />
          <textarea name="body" required minLength={2} maxLength={1000} placeholder="Agregar comentario operativo..." className="min-h-24 w-full resize-none rounded-md border border-stone-200 bg-stone-50 p-3 text-sm outline-none focus:border-stone-400 focus:bg-white" />
          <div className="mt-2 flex justify-end">
            <SubmitButton pendingLabel="Publicando..." className="h-9 rounded-md bg-stone-950 px-3 text-sm font-medium text-white disabled:opacity-50">Publicar comentario</SubmitButton>
          </div>
        </form>
        <div className="max-h-80 divide-y divide-stone-100 overflow-y-auto">
          {comments.map((comment) => (
            <article key={comment.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{comment.author}</p>
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
          <form action={uploadOrderAttachment} className="flex flex-col gap-3 border-b border-stone-100 p-4 sm:flex-row sm:items-end">
            <input type="hidden" name="orderId" value={orderId} />
            <label className="flex-1 text-xs font-medium uppercase tracking-[0.12em] text-stone-500">
              Archivo, máximo 10 MB
              <input name="file" required type="file" className="mt-2 block w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-stone-200 file:px-3 file:py-1.5 file:text-xs file:font-medium" />
            </label>
            <SubmitButton pendingLabel="Subiendo..." className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-medium text-white disabled:opacity-50">
              <FileUp className="size-4" />
              Subir
            </SubmitButton>
          </form>
        ) : null}
        <div className="max-h-80 divide-y divide-stone-100 overflow-y-auto">
          {attachments.map((attachment) => (
            <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 p-4 transition hover:bg-stone-50">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{attachment.fileName}</p>
                <p className="mt-1 text-xs text-stone-500">{formatBytes(attachment.fileSize)} · {attachment.fileType}</p>
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

function formatBytes(bytes: number) {
  if (!bytes) return "Tamaño no disponible";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
