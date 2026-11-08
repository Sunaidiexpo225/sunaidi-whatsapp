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
import { OutboundService } from "./outbound.service";

const OUTBOUND_MESSAGE_QUEUE = "outbound-message";

interface OutboundMessageJob {
  messageId: string;
}

/** Runs the BullMQ worker that drains the outbound-message queue. */
@Injectable()
export class OutboundProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboundProcessor.name);
  private worker?: Worker<OutboundMessageJob>;
  private connection?: IORedis;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly outboundService: OutboundService,
  ) {}

  onModuleInit(): void {
    this.connection = new IORedis(this.config.get("REDIS_URL", { infer: true }), {
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker<OutboundMessageJob>(
      OUTBOUND_MESSAGE_QUEUE,
      async (job: Job<OutboundMessageJob>) => {
        await this.outboundService.send(job.data.messageId);
      },
      { connection: this.connection, concurrency: 10 },
    );

    this.worker.on("failed", (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log(`Worker listening on queue "${OUTBOUND_MESSAGE_QUEUE}"`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.connection?.quit();
  }
}
