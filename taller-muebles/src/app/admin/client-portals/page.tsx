import { AppShell } from "@/components/app-shell";
import { ClientPortalManager } from "@/components/client-portal-manager";
import { requireSession } from "@/lib/auth";
import { getClientPortalManagementSnapshot } from "@/lib/client-portal-admin";

export default async function ClientPortalsPage() {
  const user = await requireSession(["admin"]);
  const snapshot = await getClientPortalManagementSnapshot();

  return (
    <AppShell active="admin" user={user}>
      <header className="border-b border-stone-200 pb-5">
        <p className="page-kicker">Portal clientes</p>
        <h1 className="page-title">Enlaces de seguimiento</h1>
        <p className="page-description max-w-3xl">
          Crea y administra accesos privados para que cada cliente vea únicamente el avance de sus propios pedidos.
        </p>
      </header>

      <ClientPortalManager {...snapshot} />
    </AppShell>
  );
}
