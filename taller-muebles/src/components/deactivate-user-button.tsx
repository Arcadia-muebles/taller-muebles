"use client";

import { UserX } from "lucide-react";
import { removeUser } from "@/app/admin/users/actions";
import { ConfirmSubmitButton } from "./confirm-submit-button";

export function DeactivateUserButton({ userId, disabled }: { userId: string; disabled: boolean }) {
  return (
    <form action={removeUser}>
      <input type="hidden" name="userId" value={userId} />
      <ConfirmSubmitButton
        title="Eliminar trabajador"
        description="Se quitara su acceso al inicio de sesion y se conservara su historial para trazabilidad."
        confirmLabel="Eliminar trabajador"
        pendingLabel="Eliminando..."
        disabled={disabled}
        triggerClassName="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-200 px-2.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
        trigger={<><UserX className="size-3.5" />Eliminar</>}
      />
    </form>
  );
}
