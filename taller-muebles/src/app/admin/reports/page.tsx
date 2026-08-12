import { AppShell } from "@/components/app-shell";
import { ReportsDashboard } from "@/components/reports-dashboard";
import { requireSession } from "@/lib/auth";
import { isProductionOrder } from "@/lib/orders";
import { listReportOrders, listReportUsers } from "@/lib/repositories/production";

export default async function ReportsPage() {
  const user = await requireSession(["admin", "manager", "viewer"]);
  const [orders, users] = await Promise.all([listReportOrders(), listReportUsers()]);

  return (
    <AppShell active="admin" user={user}>
      <ReportsDashboard
        orders={orders.filter(isProductionOrder)}
        users={users}
        today={todayInSantiago()}
      />
    </AppShell>
  );
}

function todayInSantiago() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
