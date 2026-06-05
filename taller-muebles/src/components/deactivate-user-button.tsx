"use client";

import { UserX } from "lucide-react";
import { removeUser } from "@/app/admin/users/actions";
import { SubmitButton } from "./submit-button";

export function DeactivateUserButton({ userId, disabled }: { userId: string; disabled: boolean }) {
  return (
    <form
      action={removeUser}
      onSubmit={(event) => {
        if (!window.confirm("¿Desactivar este usuario? Ya no podrá ingresar, pero conservará su trazabilidad.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <SubmitButton disabled={disabled} pendingLabel="Desactivando..." className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-200 px-2.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40">
        <UserX className="size-3.5" />
        Desactivar
      </SubmitButton>
    </form>
  );
}
