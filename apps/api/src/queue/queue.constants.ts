/** Names of the BullMQ queues shared between the API (producer) and worker (consumer). */
export const QUEUE_NAMES = {
  /** Raw inbound webhook events awaiting processing. */
  INBOUND_WEBHOOK: "inbound-webhook",
  /** Outbound messages (agent replies and badges) awaiting send. */
  OUTBOUND_MESSAGE: "outbound-message",
  /** Per-recipient campaign broadcast sends. */
  CAMPAIGN_SEND: "campaign-send",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** Injection token for the shared ioredis connection. */
export const REDIS_CONNECTION = "REDIS_CONNECTION";

/** Injection token for the inbound-webhook BullMQ queue. */
export const INBOUND_WEBHOOK_QUEUE = "INBOUND_WEBHOOK_QUEUE";

/** Injection token for the outbound-message BullMQ queue. */
export const OUTBOUND_MESSAGE_QUEUE = "OUTBOUND_MESSAGE_QUEUE";

/** Injection token for the campaign-send BullMQ queue. */
export const CAMPAIGN_SEND_QUEUE = "CAMPAIGN_SEND_QUEUE";

export interface InboundWebhookJob {
  /** Id of the WebhookEvent row this job should process. */
  webhookEventId: string;
}

export interface OutboundMessageJob {
  /** Id of the Message row (direction OUTBOUND) this job should send. */
  messageId: string;
}

export interface CampaignSendJob {
  campaignId: string;
  /** Id of the CampaignRecipient row to send to. */
  recipientId: string;
}
