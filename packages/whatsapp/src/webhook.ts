import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Validate Meta's X-Hub-Signature-256 header against the raw request body.
 * The API route must use the raw bytes, not a re-serialised JSON object.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");
  const received = signatureHeader.slice("sha256=".length);

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Handle the GET verification handshake Meta performs when subscribing a
 * webhook. Returns the challenge string to echo back, or null to reject.
 */
export function handleVerificationChallenge(
  query: { mode?: string; token?: string; challenge?: string },
  verifyToken: string,
): string | null {
  if (query.mode === "subscribe" && query.token === verifyToken) {
    return query.challenge ?? null;
  }
  return null;
}
