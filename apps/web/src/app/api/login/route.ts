import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ENABLED, DASHBOARD_PASSWORD, SESSION_COOKIE, SESSION_TOKEN } from "@/lib/server";

export async function POST(req: NextRequest) {
  if (!AUTH_ENABLED) {
    return NextResponse.json({ ok: true, note: "auth disabled" });
  }
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!body.password || body.password !== DASHBOARD_PASSWORD) {
    return NextResponse.json({ message: "Incorrect password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, SESSION_TOKEN, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
