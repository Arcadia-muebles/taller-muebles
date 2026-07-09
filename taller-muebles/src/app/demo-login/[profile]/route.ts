import { NextResponse } from "next/server";
import { dashboardPathForRole, type SessionUser } from "@/lib/auth";
import { getLocalUserByEmail } from "@/lib/local-store";

const sessionCookie = "tm_session";
const demoProfiles: Record<string, string> = {
  admin: "admin@taller.local",
  supervisor: "supervisor@taller.local",
  taller: "taller@taller.local",
  tapiceria: "tapiceria@taller.local",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ profile: string }> },
) {
  const url = new URL(request.url);
  if (process.env.LOCAL_DEMO_MODE !== "1") {
    return NextResponse.redirect(new URL("/login", url));
  }

  const { profile } = await params;
  const email = demoProfiles[profile] ?? demoProfiles.admin;
  const user = await getLocalUserByEmail(email);
  if (!user?.active) {
    return NextResponse.redirect(new URL("/login", url));
  }

  const session: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    area: user.area,
    areas: user.areas ?? parseAreas(user.area),
  };
  const response = NextResponse.redirect(new URL(dashboardPathForRole(session.role), url));
  response.cookies.set(sessionCookie, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

function encodeSession(user: SessionUser) {
  return Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
}

function parseAreas(value?: string | null) {
  return (value ?? "")
    .split(",")
    .map((area) => area.trim())
    .filter(Boolean);
}
