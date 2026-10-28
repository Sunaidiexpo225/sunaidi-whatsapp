import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import type { Env } from "../config/env";
import { InboundService } from "./inbound.service";

const INBOUND_WEBHOOK_QUEUE = "inbound-webhook";

interface InboundWebhookJob {
  webhookEventId: string;
}

/** Runs the BullMQ worker that drains the inbound-webhook queue. */
@Injectable()
export class InboundProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InboundProcessor.name);
  private worker?: Worker<InboundWebhookJob>;
  private connection?: IORedis;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly inboundService: InboundService,
  ) {}

  onModuleInit(): void {
    this.connection = new IORedis(this.config.get("REDIS_URL", { infer: true }), {
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker<InboundWebhookJob>(
      INBOUND_WEBHOOK_QUEUE,
      async (job: Job<InboundWebhookJob>) => {
        await this.inboundService.processWebhookEvent(job.data.webhookEventId);
      },
      { connection: this.connection, concurrency: 10 },
    );

    this.worker.on("failed", (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log(`Worker listening on queue "${INBOUND_WEBHOOK_QUEUE}"`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.connection?.quit();
  }
}
