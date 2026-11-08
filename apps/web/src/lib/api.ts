// Thin client for the Sunaidi API. The base URL is baked in at build time from
// NEXT_PUBLIC_API_URL, defaulting to the local API.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface EventSummary {
  id: string;
  name: string;
  phone: { id: string; displayPhone: string; displayName: string | null } | null;
}

export type ConversationStatus = "OPEN" | "PENDING" | "RESOLVED";

export interface ConversationSummary {
  id: string;
  status: ConversationStatus;
  lastMessageAt: string | null;
  assignee: { id: string; name: string | null; email: string } | null;
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

export interface DashboardSummary {
  conversations: { total: number; open: number; pending: number; resolved: number };
  messages7d: {
    outbound: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    inbound: number;
  };
  campaigns: {
    total: number;
    sending: number;
    completed: number;
    recipientsSent: number;
    recipientsFailed: number;
    recipientsQueued: number;
  };
  contacts: number;
  events: {
    phoneNumberId: string;
    name: string;
    phone: string;
    displayName: string | null;
    openConversations: number;
    sent7d: number;
  }[];
}

export interface MessageView {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  type: string;
  text: string | null;
  status: string;
  createdAt: string;
}

export interface CampaignRow {
  id: string;
  name: string;
  status: string;
  templateName: string;
  templateLanguage: string;
  eventName: string;
  recipients: { total: number; sent: number; failed: number; queued: number };
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface TemplateRow {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  eventName: string | null;
  updatedAt: string;
}

export interface TagRef {
  id: string;
  name: string;
}

export interface TagRow extends TagRef {
  contactCount: number;
}

export interface ContactRow {
  id: string;
  waId: string;
  name: string | null;
  createdAt: string;
  tags: TagRef[];
  visitor: { name: string; company: string; consent: string; country: string } | null;
}

export type ConsentFilter = "OPTED_IN" | "PENDING" | "OPTED_OUT";

export interface ContactFilter {
  search?: string;
  tagId?: string;
  consent?: ConsentFilter;
}

export interface AutomationRow {
  id: string;
  name: string;
  trigger: string;
  enabled: boolean;
  eventName: string | null;
  updatedAt: string;
}

export interface AutomationDetail {
  id: string;
  name: string;
  trigger: string;
  enabled: boolean;
  eventId: string | null;
  conditions: Record<string, unknown>;
  actions: unknown[];
}

export type UserRole = "ADMIN" | "SUPERVISOR" | "AGENT";

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
}

export interface CannedReplyRow {
  id: string;
  title: string;
  body: string;
  shortcut: string | null;
}

export interface NumberRow {
  id: string;
  eventName: string;
  displayPhone: string;
  displayName: string | null;
  phoneNumberId: string;
  wabaId: string;
  qualityRating: string;
  messagingLimit: number | null;
  graphApiVersion: string;
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

// Writes that need the internal API key go through same-origin Next route
// handlers (/api/*), which attach the key server-side.
async function local<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(method === "DELETE" ? {} : { body: JSON.stringify(body ?? {}) }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(
      (detail && (detail.message as string)) ?? `Request failed: ${res.status} ${path}`,
    );
  }
  return res.json() as Promise<T>;
}

export interface CampaignRecipientInput {
  to: string;
  components?: unknown[];
}

export const api = {
  getDashboard: () => get<DashboardSummary>("/dashboard"),
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

  listCampaigns: () => get<CampaignRow[]>("/campaigns"),
  createCampaign: (input: {
    eventId: string;
    name: string;
    templateName: string;
    templateLanguage: string;
    recipients: CampaignRecipientInput[];
    scheduledAt?: string;
  }) => local<{ id: string; status: string; recipientCount: number }>("/api/campaigns", "POST", input),
  createCampaignFromAudience: (input: {
    eventId: string;
    name: string;
    templateName: string;
    templateLanguage: string;
    consent?: ConsentFilter;
    tagId?: string;
    scheduledAt?: string;
  }) =>
    local<{ id: string; status: string; recipientCount: number }>(
      "/api/campaigns/audience",
      "POST",
      input,
    ),
  previewAudience: (input: { eventId: string; consent?: ConsentFilter; tagId?: string }) => {
    const qs = new URLSearchParams({ eventId: input.eventId });
    if (input.consent) qs.set("consent", input.consent);
    if (input.tagId) qs.set("tagId", input.tagId);
    return get<{ count: number }>(`/campaigns/audience/preview?${qs.toString()}`);
  },
  startCampaign: (id: string) =>
    local<{ id: string; status: string; queued: number }>(`/api/campaigns/${id}/start`, "POST", {}),

  listTemplates: () => get<TemplateRow[]>("/templates"),
  createTemplate: (input: {
    eventId?: string;
    name: string;
    language: string;
    category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
    components?: unknown[];
  }) => local<{ id: string; status: string }>("/api/templates", "POST", input),

  submitTemplate: (id: string) =>
    local<{ id: string; status: string; metaId: string | null }>(
      `/api/templates/${id}/submit`,
      "POST",
    ),

  listContacts: (filter: ContactFilter = {}) => {
    const qs = new URLSearchParams();
    if (filter.search) qs.set("search", filter.search);
    if (filter.tagId) qs.set("tagId", filter.tagId);
    if (filter.consent) qs.set("consent", filter.consent);
    const q = qs.toString();
    return get<ContactRow[]>(q ? `/contacts?${q}` : "/contacts");
  },

  listTags: () => get<TagRow[]>("/tags"),
  createTag: (input: { name: string; eventId?: string }) =>
    local<TagRow>("/api/tags", "POST", input),
  addContactTag: (contactId: string, tagId: string) =>
    local<{ ok: true }>(`/api/contacts/${contactId}/tags`, "POST", { tagId }),
  removeContactTag: (contactId: string, tagId: string) =>
    local<{ ok: true }>(`/api/contacts/${contactId}/tags/${tagId}`, "DELETE"),
  importContacts: (input: { contacts: { to: string; name?: string }[]; eventId?: string }) =>
    local<{ created: number; updated: number; skipped: number }>(
      "/api/contacts/import",
      "POST",
      input,
    ),

  listAutomations: () => get<AutomationRow[]>("/automations"),
  createAutomation: (input: { eventId?: string; name: string; trigger: string }) =>
    local<{ id: string; enabled: boolean }>("/api/automations", "POST", input),
  toggleAutomation: (id: string, enabled: boolean) =>
    local<{ id: string; enabled: boolean }>(`/api/automations/${id}`, "PATCH", { enabled }),
  getAutomation: (id: string) => get<AutomationDetail>(`/automations/${id}`),
  updateAutomationConfig: (
    id: string,
    input: { name?: string; conditions?: Record<string, unknown>; actions?: unknown[] },
  ) => local<{ id: string }>(`/api/automations/${id}/config`, "PATCH", input),

  listNumbers: () => get<NumberRow[]>("/numbers"),

  assignConversation: (id: string, assigneeId: string | null) =>
    local<{ id: string; assigneeId: string | null }>(
      `/api/conversations/${id}/assign`,
      "PATCH",
      { assigneeId },
    ),
  setConversationStatus: (id: string, status: ConversationStatus) =>
    local<{ id: string; status: ConversationStatus }>(
      `/api/conversations/${id}/status`,
      "PATCH",
      { status },
    ),

  listUsers: () => get<UserRow[]>("/users"),
  createUser: (input: { email: string; name?: string; role: UserRole }) =>
    local<UserRow>("/api/users", "POST", input),
  updateUser: (id: string, input: { name?: string; role?: UserRole }) =>
    local<UserRow>(`/api/users/${id}`, "PATCH", input),

  listCannedReplies: () => get<CannedReplyRow[]>("/canned-replies"),
  createCannedReply: (input: { title: string; body: string; shortcut?: string }) =>
    local<CannedReplyRow>("/api/canned-replies", "POST", input),
  deleteCannedReply: (id: string) =>
    local<{ ok: true }>(`/api/canned-replies/${id}`, "DELETE"),
};
