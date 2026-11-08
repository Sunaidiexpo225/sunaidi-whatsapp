// Server-only configuration. Never import this from a client component — it
// reads server secrets (API key, dashboard password).
import { createHash } from "node:crypto";

export const SERVER_API_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? "";

/** Shared passcode for the dashboard. When unset, the login gate is disabled
 * (useful in local dev). */
export const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD ?? "";

export const SESSION_COOKIE = "sunaidi_session";

/** The value stored in the session cookie once logged in. Derived from the
 * password when a dedicated token isn't provided (never the password itself). */
export const SESSION_TOKEN =
  process.env.SESSION_TOKEN ??
  (DASHBOARD_PASSWORD ? createHash("sha256").update(DASHBOARD_PASSWORD).digest("hex") : "");

export const AUTH_ENABLED = DASHBOARD_PASSWORD.length > 0;
