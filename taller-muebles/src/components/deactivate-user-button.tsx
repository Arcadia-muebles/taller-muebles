"use client";

import { Trash2 } from "lucide-react";
import { removeUser } from "@/app/admin/users/actions";
import { ConfirmSubmitButton } from "./confirm-submit-button";

export function DeactivateUserButton({ userId, disabled }: { userId: string; disabled: boolean }) {
  return (
    <form action={removeUser}>
      <input type="hidden" name="userId" value={userId} />
      <ConfirmSubmitButton
        title="Eliminar usuario"
        description="Esta accion borrara la cuenta del usuario de la base de datos. Las ordenes existentes conservaran sus datos, pero la cuenta ya no estara disponible."
        confirmLabel="Eliminar usuario"
        pendingLabel="Eliminando..."
        disabled={disabled}
        triggerClassName="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-200 px-2.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
        trigger={<><Trash2 className="size-3.5" />Eliminar</>}
      />
    </form>
  );
}
