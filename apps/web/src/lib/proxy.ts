import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_ENABLED,
  INTERNAL_API_KEY,
  SERVER_API_URL,
  SESSION_COOKIE,
  SESSION_TOKEN,
} from "./server";

function authed(req: NextRequest): boolean {
  if (!AUTH_ENABLED) return true;
  return req.cookies.get(SESSION_COOKIE)?.value === SESSION_TOKEN;
}

/** Forward a write to the NestJS API, attaching the internal API key. Requires
 * a valid dashboard session (when auth is enabled). */
export async function forward(
  req: NextRequest,
  path: string,
  method: "POST" | "PATCH" | "DELETE",
): Promise<NextResponse> {
  if (!authed(req)) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }
  const body = method === "DELETE" ? "" : await req.text();
  const res = await fetch(`${SERVER_API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-api-key": INTERNAL_API_KEY },
    ...(method === "DELETE" ? {} : { body: body || "{}" }),
    cache: "no-store",
  });
  const text = await res.text();
  return new NextResponse(text || "{}", {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
