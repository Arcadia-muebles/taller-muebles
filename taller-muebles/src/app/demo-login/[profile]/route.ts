import { redirect } from "next/navigation";
import { dashboardPathForRole, signInLocal, type SessionUser } from "@/lib/auth";
import { getLocalUserByEmail } from "@/lib/local-store";

const demoProfiles: Record<string, string> = {
  admin: "admin@taller.local",
  supervisor: "supervisor@taller.local",
  taller: "taller@taller.local",
  tapiceria: "tapiceria@taller.local",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ profile: string }> },
) {
  if (process.env.LOCAL_DEMO_MODE !== "1") {
    redirect("/login");
  }

  const { profile } = await params;
  const email = demoProfiles[profile] ?? demoProfiles.admin;
  const user = await getLocalUserByEmail(email);
  if (!user?.active) {
    redirect("/login");
  }

  const session: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    area: user.area,
    areas: user.areas ?? parseAreas(user.area),
  };
  await signInLocal(session);
  redirect(dashboardPathForRole(session.role));
}

function parseAreas(value?: string | null) {
  return (value ?? "")
    .split(",")
    .map((area) => area.trim())
    .filter(Boolean);
}
