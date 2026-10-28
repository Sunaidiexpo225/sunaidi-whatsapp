import { Inject, Injectable, Logger } from "@nestjs/common";
import type { PrismaClient } from "@sunaidi/db";
import type { Queue } from "bullmq";
import { PRISMA } from "../db/prisma.module";
import {
  INBOUND_WEBHOOK_QUEUE,
  type InboundWebhookJob,
} from "../queue/queue.constants";

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(INBOUND_WEBHOOK_QUEUE)
    private readonly inboundQueue: Queue<InboundWebhookJob>,
  ) {}

  /**
   * Store the raw webhook payload and enqueue it for the worker. The API does no
   * parsing here: it persists the event (so nothing is lost) and returns fast, so
   * Meta always gets its 200 within seconds.
   */
  async acceptInboundEvent(payload: unknown): Promise<void> {
    const event = await this.prisma.webhookEvent.create({
      data: { payload: payload as object },
      select: { id: true },
    });

    await this.inboundQueue.add(
      "process",
      { webhookEventId: event.id },
      {
        jobId: event.id, // idempotent: a retried delivery reuses the same job id
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
      },
    );

    this.logger.debug(`Accepted webhook event ${event.id}`);
  }
}
