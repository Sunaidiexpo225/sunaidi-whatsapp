import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_ENABLED, SESSION_COOKIE, SESSION_TOKEN } from "@/lib/server";

// Server-side gate for every dashboard page. The /login page lives outside
// this group, so it stays reachable when logged out.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (AUTH_ENABLED) {
    const session = (await cookies()).get(SESSION_COOKIE)?.value;
    if (session !== SESSION_TOKEN) {
      redirect("/login");
    }
  }
  return <>{children}</>;
}
