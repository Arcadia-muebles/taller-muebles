import { redirect } from "next/navigation";
import { dashboardPathForRole, getSessionUser } from "@/lib/auth";

export default async function Home() {
  const user = await getSessionUser();
  redirect(user ? dashboardPathForRole(user.role) : "/login");
}
