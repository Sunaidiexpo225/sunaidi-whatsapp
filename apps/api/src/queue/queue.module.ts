import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { Env } from "../config/env";
import {
  INBOUND_WEBHOOK_QUEUE,
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
  ],
  exports: [REDIS_CONNECTION, INBOUND_WEBHOOK_QUEUE],
})
export class QueueModule {}
