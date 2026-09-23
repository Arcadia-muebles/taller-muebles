"use client";

import { UserRoundX } from "lucide-react";
import { useActionState } from "react";
import { setUserActive, type UserActionResult } from "@/app/admin/users/actions";
import { ConfirmSubmitButton } from "./confirm-submit-button";

export function DeactivateUserButton({ userId, disabled, active }: { userId: string; disabled: boolean; active: boolean }) {
  const [state, action] = useActionState(async (_previous: UserActionResult, formData: FormData) => setUserActive(formData), { ok: false, message: "" });
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="active" value={String(!active)} />
      <ConfirmSubmitButton
        title={active ? "Desactivar usuario" : "Reactivar usuario"}
        description={active ? "La cuenta dejará de tener acceso. Sus órdenes y su historial se conservarán y podrás reactivarla más adelante." : "La cuenta recuperará el acceso con su rol y procesos asignados."}
        confirmLabel={active ? "Desactivar" : "Reactivar"}
        pendingLabel="Guardando..."
        disabled={disabled}
        triggerClassName="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-200 px-2.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
        trigger={<><UserRoundX className="size-3.5" />{active ? "Desactivar" : "Reactivar"}</>}
      />
      {state.message ? <p role="status" className={`mt-2 text-xs ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p> : null}
    </form>
  );
}
