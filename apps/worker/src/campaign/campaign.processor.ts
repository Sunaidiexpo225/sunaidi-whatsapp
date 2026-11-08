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
import { CampaignService } from "./campaign.service";

const CAMPAIGN_SEND_QUEUE = "campaign-send";

interface CampaignSendJob {
  campaignId: string;
  recipientId: string;
}

/** Runs the BullMQ worker that drains the campaign-send queue. */
@Injectable()
export class CampaignProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampaignProcessor.name);
  private worker?: Worker<CampaignSendJob>;
  private connection?: IORedis;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly campaignService: CampaignService,
  ) {}

  onModuleInit(): void {
    this.connection = new IORedis(this.config.get("REDIS_URL", { infer: true }), {
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker<CampaignSendJob>(
      CAMPAIGN_SEND_QUEUE,
      async (job: Job<CampaignSendJob>) => {
        await this.campaignService.sendRecipient(job.data.campaignId, job.data.recipientId);
      },
      // Keep concurrency modest so broadcasts stay within Meta's send rate.
      { connection: this.connection, concurrency: 5 },
    );

    this.worker.on("failed", (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log(`Worker listening on queue "${CAMPAIGN_SEND_QUEUE}"`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.connection?.quit();
  }
}
