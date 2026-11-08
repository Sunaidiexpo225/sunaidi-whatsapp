import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { Env } from "../config/env";
import {
  CAMPAIGN_SEND_QUEUE,
  INBOUND_WEBHOOK_QUEUE,
  OUTBOUND_MESSAGE_QUEUE,
  QUEUE_NAMES,
  REDIS_CONNECTION,
} from "./queue.constants";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new IORedis(config.get("REDIS_URL", { infer: true }), {
          maxRetriesPerRequest: null,
        }),
    },
    {
      provide: INBOUND_WEBHOOK_QUEUE,
      inject: [REDIS_CONNECTION],
      useFactory: (connection: IORedis) =>
        new Queue(QUEUE_NAMES.INBOUND_WEBHOOK, { connection }),
    },
    {
      provide: OUTBOUND_MESSAGE_QUEUE,
      inject: [REDIS_CONNECTION],
      useFactory: (connection: IORedis) =>
        new Queue(QUEUE_NAMES.OUTBOUND_MESSAGE, { connection }),
    },
    {
      provide: CAMPAIGN_SEND_QUEUE,
      inject: [REDIS_CONNECTION],
      useFactory: (connection: IORedis) =>
        new Queue(QUEUE_NAMES.CAMPAIGN_SEND, { connection }),
    },
  ],
  exports: [
    REDIS_CONNECTION,
    INBOUND_WEBHOOK_QUEUE,
    OUTBOUND_MESSAGE_QUEUE,
    CAMPAIGN_SEND_QUEUE,
  ],
})
export class QueueModule {}
