// Minimal types for the Meta WhatsApp Cloud API surface we use. Expanded as
// features land; kept hand-written because the Cloud API is plain HTTPS/JSON.

export interface WhatsAppClientConfig {
  /** Graph API version, e.g. "v23.0". */
  graphApiVersion: string;
  /** System-user permanent access token. */
  accessToken: string;
  /** Default phone number id to send from; can be overridden per call. */
  phoneNumberId?: string;
  /** Override the Graph base URL (tests). Defaults to https://graph.facebook.com. */
  baseUrl?: string;
}

export type OutboundMessage =
  | TextMessage
  | TemplateMessage
  | MediaMessage
  | InteractiveMessage;

export interface TextMessage {
  type: "text";
  to: string;
  text: { body: string; preview_url?: boolean };
}

export interface TemplateMessage {
  type: "template";
  to: string;
  template: {
    name: string;
    language: { code: string };
    components?: unknown[];
  };
}

export interface MediaMessage {
  type: "image" | "document" | "video" | "audio";
  to: string;
  media: { id?: string; link?: string; caption?: string; filename?: string };
}

export interface InteractiveMessage {
  type: "interactive";
  to: string;
  interactive: unknown;
}

export interface SendMessageResult {
  messageId: string;
  waContactId: string;
}

/** Error thrown for any non-2xx Graph API response. */
export class WhatsAppApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "WhatsAppApiError";
  }
}
