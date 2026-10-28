import {
  type OutboundMessage,
  type SendMessageResult,
  type WhatsAppClientConfig,
  WhatsAppApiError,
} from "./types.js";

/**
 * Thin typed wrapper over the Meta WhatsApp Cloud API (Graph API).
 *
 * This is a skeleton: send() and the template/media helpers are the methods the
 * worker will call. Rate limiting, retries and queueing live in the worker, not
 * here, so this stays a plain request/response client.
 */
export class WhatsAppClient {
  private readonly baseUrl: string;

  constructor(private readonly config: WhatsAppClientConfig) {
    this.baseUrl = config.baseUrl ?? "https://graph.facebook.com";
  }

  /** Send one message. Returns Meta's wamid. */
  async send(
    message: OutboundMessage,
    phoneNumberId = this.config.phoneNumberId,
  ): Promise<SendMessageResult> {
    if (!phoneNumberId) {
      throw new Error("phoneNumberId is required (set it in config or pass it to send)");
    }

    const body = this.toGraphBody(message);
    const json = await this.post<GraphSendResponse>(
      `/${phoneNumberId}/messages`,
      body,
    );

    const messageId = json.messages?.[0]?.id;
    const waContactId = json.contacts?.[0]?.wa_id;
    if (!messageId || !waContactId) {
      throw new WhatsAppApiError("Unexpected send response", 200, undefined, json);
    }
    return { messageId, waContactId };
  }

  private toGraphBody(message: OutboundMessage): Record<string, unknown> {
    const base = { messaging_product: "whatsapp", to: message.to };
    switch (message.type) {
      case "text":
        return { ...base, type: "text", text: message.text };
      case "template":
        return { ...base, type: "template", template: message.template };
      case "interactive":
        return { ...base, type: "interactive", interactive: message.interactive };
      case "image":
      case "document":
      case "video":
      case "audio":
        return { ...base, type: message.type, [message.type]: message.media };
      default: {
        // Exhaustiveness guard.
        const _never: never = message;
        throw new Error(`Unsupported message type: ${JSON.stringify(_never)}`);
      }
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}/${this.config.graphApiVersion}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => ({}))) as GraphErrorResponse & T;
    if (!res.ok) {
      throw new WhatsAppApiError(
        json?.error?.message ?? `Graph API error ${res.status}`,
        res.status,
        json?.error?.code,
        json?.error,
      );
    }
    return json;
  }
}

interface GraphSendResponse {
  messages?: { id: string }[];
  contacts?: { wa_id: string }[];
}

interface GraphErrorResponse {
  error?: { message: string; code: number; type?: string; error_data?: unknown };
}
