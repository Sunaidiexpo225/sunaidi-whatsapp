// Parsing of Meta's inbound webhook payload into a normalised shape the worker
// can act on. Pure functions only — no I/O — so they are easy to test.

export interface RawWebhookPayload {
  object?: string;
  entry?: RawEntry[];
}

interface RawEntry {
  id?: string;
  changes?: RawChange[];
}

interface RawChange {
  field?: string;
  value?: RawValue;
}

interface RawValue {
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: { profile?: { name?: string }; wa_id?: string }[];
  messages?: RawMessage[];
  statuses?: RawStatus[];
}

interface RawMessage {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  [key: string]: unknown;
}

interface RawStatus {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: { code?: number; title?: string; message?: string }[];
}

export interface ParsedMessage {
  /** Meta's wamid. */
  waMessageId: string;
  /** Sender's WhatsApp id (phone). */
  from: string;
  /** Message type: text, image, document, interactive, etc. */
  type: string;
  timestamp: Date;
  /** Body text for text messages. */
  text?: string;
  /** Display name from the contacts array, when present. */
  profileName?: string;
  /** The untouched message object, stored as-is. */
  raw: Record<string, unknown>;
}

export type DeliveryStatus = "sent" | "delivered" | "read" | "failed";

export interface ParsedStatus {
  waMessageId: string;
  status: DeliveryStatus;
  recipientId: string;
  timestamp: Date;
  errorCode?: string;
  errorMessage?: string;
}

/** Messages and statuses for one phone number, from one webhook delivery. */
export interface ParsedInbound {
  /** Meta phone number id (metadata.phone_number_id) the events belong to. */
  phoneNumberId: string;
  messages: ParsedMessage[];
  statuses: ParsedStatus[];
}

const VALID_STATUSES = new Set<DeliveryStatus>(["sent", "delivered", "read", "failed"]);

function toDate(timestamp: string | undefined): Date {
  // Meta sends Unix seconds as a string; fall back to now if absent.
  const seconds = timestamp ? Number(timestamp) : NaN;
  return Number.isFinite(seconds) ? new Date(seconds * 1000) : new Date();
}

/**
 * Parse a webhook payload into one ParsedInbound per phone number that has any
 * messages or statuses. Changes other than "messages" (e.g. template status
 * updates) are ignored here and handled elsewhere.
 */
export function parseInboundPayload(payload: RawWebhookPayload): ParsedInbound[] {
  const result: ParsedInbound[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!value || !phoneNumberId) continue;

      const names = new Map<string, string>();
      for (const contact of value.contacts ?? []) {
        if (contact.wa_id && contact.profile?.name) {
          names.set(contact.wa_id, contact.profile.name);
        }
      }

      const messages: ParsedMessage[] = [];
      for (const m of value.messages ?? []) {
        if (!m.id || !m.from) continue;
        const { text, ...rest } = m;
        const profileName = names.get(m.from);
        messages.push({
          waMessageId: m.id,
          from: m.from,
          type: m.type ?? "unknown",
          timestamp: toDate(m.timestamp),
          text: m.text?.body,
          ...(profileName ? { profileName } : {}),
          raw: rest as Record<string, unknown>,
        });
      }

      const statuses: ParsedStatus[] = [];
      for (const s of value.statuses ?? []) {
        if (!s.id || !s.status || !VALID_STATUSES.has(s.status as DeliveryStatus)) continue;
        const firstError = s.errors?.[0];
        statuses.push({
          waMessageId: s.id,
          status: s.status as DeliveryStatus,
          recipientId: s.recipient_id ?? "",
          timestamp: toDate(s.timestamp),
          ...(firstError?.code !== undefined ? { errorCode: String(firstError.code) } : {}),
          ...(firstError?.title || firstError?.message
            ? { errorMessage: firstError.title ?? firstError.message }
            : {}),
        });
      }

      if (messages.length > 0 || statuses.length > 0) {
        result.push({ phoneNumberId, messages, statuses });
      }
    }
  }

  return result;
}
