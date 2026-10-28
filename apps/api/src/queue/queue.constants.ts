/** Names of the BullMQ queues shared between the API (producer) and worker (consumer). */
export const QUEUE_NAMES = {
  /** Raw inbound webhook events awaiting processing. */
  INBOUND_WEBHOOK: "inbound-webhook",
  /** Outbound messages (agent replies and broadcasts) awaiting send. */
  OUTBOUND_MESSAGE: "outbound-message",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** Injection token for the shared ioredis connection. */
export const REDIS_CONNECTION = "REDIS_CONNECTION";

/** Injection token for the inbound-webhook BullMQ queue. */
export const INBOUND_WEBHOOK_QUEUE = "INBOUND_WEBHOOK_QUEUE";

export interface InboundWebhookJob {
  /** Id of the WebhookEvent row this job should process. */
  webhookEventId: string;
}
