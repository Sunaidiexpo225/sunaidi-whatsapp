// Thin client for the Sunaidi API. The base URL is baked in at build time from
// NEXT_PUBLIC_API_URL, defaulting to the local API.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface EventSummary {
  id: string;
  name: string;
  phone: { id: string; displayPhone: string; displayName: string | null } | null;
}

export interface ConversationSummary {
  id: string;
  status: "OPEN" | "PENDING" | "RESOLVED";
  lastMessageAt: string | null;
  contact: {
    id: string;
    name: string | null;
    waId: string;
    // Set when the WhatsApp number matches a VDMS visitor record.
    visitor: { name: string; company: string; consent: string } | null;
  };
  lastMessage: {
    type: string;
    text: string | null;
    direction: "INBOUND" | "OUTBOUND";
    createdAt: string;
  } | null;
}

export interface MessageView {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  type: string;
  text: string | null;
  status: string;
  createdAt: string;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${path}`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(
      (detail && (detail.message as string)) ?? `Request failed: ${res.status} ${path}`,
    );
  }
  return res.json() as Promise<T>;
}

export const api = {
  listEvents: () => get<EventSummary[]>("/events"),
  listConversations: (eventId?: string) =>
    get<ConversationSummary[]>(
      eventId ? `/conversations?eventId=${encodeURIComponent(eventId)}` : "/conversations",
    ),
  getMessages: (conversationId: string) =>
    get<MessageView[]>(`/conversations/${conversationId}/messages`),
  sendReply: (conversationId: string, text: string) =>
    post<{ id: string; status: string }>(
      `/conversations/${conversationId}/messages`,
      { text },
    ),
};
